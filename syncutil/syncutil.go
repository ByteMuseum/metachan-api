package syncutil

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"math/rand/v2"
	"net/http"
	"sync"
	"time"

	"metachan-api/config"
	"metachan-api/database"
	"metachan-api/utils/log"

	"github.com/lib/pq"
	"gorm.io/gorm"
)

//go:embed queries/anilist.graphql
var anilistQuery string

const (
	anilistAPIURL     = "https://graphql.anilist.co"
	requestsPerMinute = 90
	mappingSourceURL  = "https://raw.githubusercontent.com/Fribb/anime-lists/refs/heads/master/anime-list-full.json"
	syncBatchSize     = 100
)

const (
	maxRetries            = 500
	baseRetryDelaySeconds = 30
	maxRetryDelaySeconds  = 600
	jitterFactor          = 0.1
)

var logger = log.NewLogger(log.WithLevelInt(config.Config.LogLevel))

type advancedRateLimiter struct {
	mutex          sync.Mutex
	tokens         int
	maxTokens      int
	refillRate     int
	lastRefillTime time.Time
}

func newAdvancedRateLimiter() *advancedRateLimiter {
	return &advancedRateLimiter{
		tokens:         90, // Starting with max tokens
		maxTokens:      90, // Maximum tokens allowed
		refillRate:     90, // Tokens per minute
		lastRefillTime: time.Now(),
	}
}

func (rl *advancedRateLimiter) wait() {
	rl.mutex.Lock()
	defer rl.mutex.Unlock()

	// Refill tokens based on time passed
	now := time.Now()
	timeSinceLastRefill := now.Sub(rl.lastRefillTime)
	tokensToAdd := int(timeSinceLastRefill.Minutes() * float64(rl.refillRate))

	if tokensToAdd > 0 {
		rl.tokens = min(rl.maxTokens, rl.tokens+tokensToAdd)
		rl.lastRefillTime = now
	}

	// If no tokens available, wait
	for rl.tokens <= 0 {
		waitTime := time.Duration(float64(time.Minute) / float64(rl.refillRate))
		time.Sleep(waitTime)

		rl.tokens++
		rl.lastRefillTime = time.Now()
	}

	// Consume a token
	rl.tokens--
}

// Helper function to get minimum of two integers
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// Modify the Sync function to use the new rate limiter
func Sync() {
	logger.Infof("Starting sync process...")
	mappings := fetchMappings()
	if len(mappings) == 0 {
		logger.Error("No mappings fetched, aborting sync")
		return
	}

	client := &http.Client{Timeout: 30 * time.Second}
	limiter := newAdvancedRateLimiter()

	stats := processMappings(mappings, client, limiter)
	logger.Infof("Sync completed - Processed: %d, Errors: %d", stats.processed, stats.errors)
}

func fetchMappings() []*fribbMapping {
	resp, err := http.Get(mappingSourceURL)
	if err != nil {
		logger.Errorf("Failed to fetch mappings: %v", err)
		return nil
	}
	defer resp.Body.Close()

	var mappings []*fribbMapping
	if err := json.NewDecoder(resp.Body).Decode(&mappings); err != nil {
		logger.Errorf("Failed to decode mappings: %v", err)
		return nil
	}

	return mappings
}

type syncStats struct {
	processed, errors int
}

func processMappings(mappings []*fribbMapping, client *http.Client, limiter *advancedRateLimiter) syncStats {
	var stats syncStats
	var statsMutex sync.Mutex
	validMappings := filterValidMappings(mappings)

	// Create a channel to limit concurrent processing
	maxConcurrent := 10 // Adjust based on your system's capabilities
	semaphore := make(chan struct{}, maxConcurrent)
	var wg sync.WaitGroup

	for _, mapping := range validMappings {
		// Acquire semaphore
		semaphore <- struct{}{}
		wg.Add(1)

		go func(mapping *fribbMapping) {
			defer func() {
				// Release semaphore and mark goroutine as done
				<-semaphore
				wg.Done()
			}()

			// Apply rate limiting
			limiter.wait()

			// Process the mapping
			if err := processMapping(mapping, client); err != nil {
				logger.Errorf("Failed to process mapping %d: %v", mapping.Anilist, err)
				statsMutex.Lock()
				stats.errors++
				statsMutex.Unlock()
				return
			}

			// Update stats
			statsMutex.Lock()
			stats.processed++

			// testing: stop processing after 20 mappings
			if stats.processed >= 20 {
				statsMutex.Unlock()
				return
			}

			// Progress logging
			if stats.processed%syncBatchSize == 0 {
				logger.Infof("Progress: %d/%d processed", stats.processed, len(validMappings))
			}
			statsMutex.Unlock()
		}(mapping)
	}

	// Wait for all goroutines to complete
	wg.Wait()

	return stats
}

func filterValidMappings(mappings []*fribbMapping) []*fribbMapping {
	valid := make([]*fribbMapping, 0, len(mappings))
	for _, m := range mappings {
		if m.Anilist != 0 {
			valid = append(valid, m)
		}
	}
	return valid
}

// pad any generic type with spaces to the right
func pad(toPad interface{}, length int) string {
	return fmt.Sprintf("%-*v", length, toPad)
}
func processMapping(mapping *fribbMapping, client *http.Client) error {
	// First check if anime exists and its status
	var existingAnime database.Anime
	err := database.DB.Where("anilist = ?", mapping.Anilist).First(&existingAnime).Error
	exists := !errors.Is(err, gorm.ErrRecordNotFound)

	// If anime exists and is finished/completed, skip processing
	if exists {
		if existingAnime.Status == database.Finished ||
			existingAnime.Status == database.Cancelled ||
			existingAnime.Status == database.Hiatus {
			logger.Debugf("Skipping mapping %s | Title: %s (Status: %s)",
				pad(mapping.Anilist, 6),
				existingAnime.Titles.UserPreferred,
				existingAnime.Status)
			return nil
		}
	}

	// Fetch anime data from Anilist
	media, err := fetchAnimeData(client, mapping.Anilist)
	if err != nil {
		return fmt.Errorf("fetch failed: %w", err)
	}

	// Get preferred title for logging
	title := media.Title.UserPreferred
	if title == "" {
		title = media.Title.Romaji
	}
	if title == "" {
		title = media.Title.English
	}
	if title == "" {
		title = media.Title.Native
	}

	status := convertStatus(media.Status)
	logger.Debugf("Processing mapping %s | Title: %s (Status: %s)",
		pad(mapping.Anilist, 6),
		title,
		status)

	// Build the anime model
	anime := buildAnimeModel(media, mapping)

	return database.DB.Transaction(func(tx *gorm.DB) error {
		if exists {
			// Update existing anime
			anime.ID = existingAnime.ID
			logger.Debugf("Updating existing anime with ID: %d", anime.ID)

			if err := tx.Model(&existingAnime).Updates(anime).Error; err != nil {
				return fmt.Errorf("update anime failed: %w", err)
			}

			// Clear existing relationships
			if err := tx.Where("anime_id = ?", anime.ID).Delete(&database.AnimeExternalLink{}).Error; err != nil {
				return fmt.Errorf("clear external links failed: %w", err)
			}
			if err := tx.Exec("DELETE FROM anime_to_characters WHERE anime_id = ?", anime.ID).Error; err != nil {
				return fmt.Errorf("clear characters failed: %w", err)
			}
			if err := tx.Exec("DELETE FROM anime_to_staff WHERE anime_id = ?", anime.ID).Error; err != nil {
				return fmt.Errorf("clear staff failed: %w", err)
			}
			if err := tx.Exec("DELETE FROM anime_to_genres WHERE anime_id = ?", anime.ID).Error; err != nil {
				return fmt.Errorf("clear genres failed: %w", err)
			}
			if err := tx.Exec("DELETE FROM anime_to_studios WHERE anime_id = ?", anime.ID).Error; err != nil {
				return fmt.Errorf("clear studios failed: %w", err)
			}
			if err := tx.Exec("DELETE FROM anime_to_tags WHERE anime_id = ?", anime.ID).Error; err != nil {
				return fmt.Errorf("clear tags failed: %w", err)
			}
		} else {
			// Create new anime
			logger.Debugf("Creating new anime")
			result := tx.Create(&anime)
			if result.Error != nil {
				return fmt.Errorf("create anime failed: %w", result.Error)
			}
			logger.Debugf("Created new anime with ID: %d", anime.ID)
		}

		// Process relationships
		if err := processCharacters(tx, media.Characters, anime.ID); err != nil {
			return fmt.Errorf("process characters failed: %w", err)
		}
		if err := processStaff(tx, media.Staff, anime.ID); err != nil {
			return fmt.Errorf("process staff failed: %w", err)
		}
		if err := processGenres(tx, media.Genres, anime.ID); err != nil {
			return fmt.Errorf("process genres failed: %w", err)
		}
		if err := processStudios(tx, media.Studios.Edges, anime.ID); err != nil {
			return fmt.Errorf("process studios failed: %w", err)
		}
		if err := processTags(tx, media.Tags, anime.ID); err != nil {
			return fmt.Errorf("process tags failed: %w", err)
		}

		return nil
	})
}

func fetchAnimeData(client *http.Client, id int) (*anilistMedia, error) {
	var lastErr error
	for attempt := 0; attempt < maxRetries; attempt++ {
		reqBody := anilistRequest{
			Query:     anilistQuery,
			Variables: map[string]any{"id": id},
		}

		jsonData, err := json.Marshal(reqBody)
		if err != nil {
			return nil, fmt.Errorf("marshal request failed: %w", err)
		}

		req, err := http.NewRequest(http.MethodPost, anilistAPIURL, bytes.NewBuffer(jsonData))
		if err != nil {
			return nil, fmt.Errorf("create request failed: %w", err)
		}

		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Accept", "application/json")

		resp, err := client.Do(req)
		if err != nil {
			lastErr = fmt.Errorf("request failed: %w", err)
			continue
		}
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			lastErr = fmt.Errorf("read response failed: %w", err)
			continue
		}

		// Check for 429 (Too Many Requests) status
		if resp.StatusCode == http.StatusTooManyRequests {
			delay := calculateBackoffDelay(attempt)
			logger.Warnf("Rate limited on mapping %d. Waiting %v before retry", id, delay)
			time.Sleep(delay)
			lastErr = fmt.Errorf("rate limited: status %d", resp.StatusCode)
			continue
		}

		// For non-200 status codes other than 429
		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("bad status: %d", resp.StatusCode)
		}

		var aniResp anilistResponse
		if err := json.Unmarshal(body, &aniResp); err != nil {
			return nil, fmt.Errorf("unmarshal response failed: %w", err)
		}

		if len(aniResp.Errors) > 0 {
			return nil, fmt.Errorf("API error: %s", aniResp.Errors[0].Message)
		}

		if aniResp.Data.Media == nil {
			return nil, fmt.Errorf("no media data")
		}

		return aniResp.Data.Media, nil
	}

	return nil, fmt.Errorf("failed after %d attempts. Last error: %w", maxRetries, lastErr)
}

// calculateBackoffDelay implements an exponential backoff with jitter
func calculateBackoffDelay(attempt int) time.Duration {
	// Calculate exponential backoff
	expBackoff := math.Pow(2, float64(attempt)) * baseRetryDelaySeconds

	// Add jitter to prevent thundering herd problem
	jitter := expBackoff * jitterFactor * (2*rand.Float64() - 1)

	// Combine and cap the delay
	delay := time.Duration(math.Min(expBackoff+jitter, maxRetryDelaySeconds)) * time.Second

	return delay
}

func buildAnimeModel(media *anilistMedia, mapping *fribbMapping) database.Anime {
	return database.Anime{
		Titles:          buildTitles(media.Title),
		Mappings:        buildMappings(mapping, media.IDMal),
		Formats:         buildFormats(media.Format, mapping.Type),
		StartDate:       convertDate(media.StartDate),
		EndDate:         convertDate(media.EndDate),
		Status:          convertStatus(media.Status),
		Description:     media.Description,
		Season:          convertSeason(media.Season),
		SeasonYear:      media.SeasonYear,
		Duration:        media.Duration,
		CountryOfOrigin: media.CountryOfOrigin,
		Source:          convertSource(media.Source),
		Hashtag:         media.Hashtag,
		CoverImage:      convertImage(media.CoverImage),
		BannerImage:     media.BannerImage,
		Color:           media.CoverImage.Color,
		Synonyms:        media.Synonyms,
		IsAdult:         media.IsAdult,
		Scores:          buildScores(media),
	}
}

func buildTitles(title anilistName) database.AnilistName {
	return database.AnilistName{
		Romaji:        title.Romaji,
		English:       title.English,
		Native:        title.Native,
		UserPreferred: title.UserPreferred,
	}
}

func buildMappings(mapping *fribbMapping, malID int) database.AnimeMapping {
	return database.AnimeMapping{
		AniDB:       mapping.AniDB,
		Anilist:     mapping.Anilist,
		AnimePlanet: mapping.AnimePlanet,
		AniSearch:   mapping.AniSearch,
		Kitsu:       mapping.Kitsu,
		LiveChart:   mapping.LiveChart,
		MyAnimeList: malID,
		NotifyMoe:   mapping.NotifyMoe,
		TheMovieDB:  mapping.TMDB.value,
		TheTVDB:     mapping.TVDB,
	}
}

func buildFormats(format, frisbeeType string) database.AnimeFormats {
	return database.AnimeFormats{
		Anilist: convertFormat(format),
		Fribb:   frisbeeType,
	}
}

func buildScores(media *anilistMedia) database.AnimeScores {
	return database.AnimeScores{
		AnilistScores: database.AnilistAnimeScores{
			Average:    media.AverageScore,
			Mean:       media.MeanScore,
			Popularity: media.Popularity,
			Trending:   media.Trending,
			Favourites: media.Favourites,
		},
	}
}

func convertDate(date anilistDate) database.Date {
	return database.Date{
		Year:  date.Year,
		Month: date.Month,
		Day:   date.Day,
	}
}

func convertImage(img anilistImage) database.AnilistImage {
	return database.AnilistImage{
		ExtraLarge: img.ExtraLarge,
		Large:      img.Large,
		Medium:     img.Medium,
	}
}

func convertFormat(format string) database.AnilistAnimeFormat {
	formats := map[string]database.AnilistAnimeFormat{
		"TV":       database.FormatTV,
		"TV_SHORT": database.FormatTVShort,
		"MOVIE":    database.FormatMovie,
		"SPECIAL":  database.FormatSpecial,
		"OVA":      database.FormatOVA,
		"ONA":      database.FormatONA,
		"MUSIC":    database.FormatMusic,
		"MANGA":    database.FormatManga,
		"NOVEL":    database.FormatNovel,
		"ONE_SHOT": database.FormatOneShot,
	}

	if f, ok := formats[format]; ok {
		return f
	}
	return database.FormatTV
}

func convertStatus(status string) database.AnimeStatus {
	statuses := map[string]database.AnimeStatus{
		"RELEASING":        database.Releasing,
		"FINISHED":         database.Finished,
		"NOT_YET_RELEASED": database.NotYetReleased,
		"CANCELLED":        database.Cancelled,
		"HIATUS":           database.Hiatus,
	}

	if s, ok := statuses[status]; ok {
		return s
	}
	return database.Releasing
}

func convertSeason(season string) database.AnimeSeason {
	seasons := map[string]database.AnimeSeason{
		"WINTER": database.Winter,
		"SPRING": database.Spring,
		"SUMMER": database.Summer,
		"FALL":   database.Fall,
	}

	if s, ok := seasons[season]; ok {
		return s
	}
	return database.Winter
}

func convertSource(source string) database.AnilistAnimeSource {
	sources := map[string]database.AnilistAnimeSource{
		"ORIGINAL":           database.AnilistSourceOriginal,
		"MANGA":              database.AnilistSourceManga,
		"LIGHT_NOVEL":        database.AnilistSourceLightNovel,
		"VISUAL_NOVEL":       database.AnilistSourceVisualNovel,
		"VIDEO_GAME":         database.AnilistSourceVideoGame,
		"OTHER":              database.AnilistSourceOther,
		"DOUJINSHI":          database.AnilistSourceDoujinshi,
		"ANIME":              database.AnilistSourceAnime,
		"WEB_NOVEL":          database.AnilistSourceWebNovel,
		"LIVE_ACTION":        database.AnilistSourceLiveAction,
		"GAME":               database.AnilistSourceGame,
		"COMIC":              database.AnilistSourceComic,
		"MULTIMEDIA_PROJECT": database.AnilistSourceMultimediaProject,
		"PICTURE_BOOK":       database.AnilistSourcePictureBook,
	}

	if s, ok := sources[source]; ok {
		return s
	}
	return database.AnilistSourceOriginal
}

func processCharacters(tx *gorm.DB, characters anilistCharacterConnection, animeID uint) error {
	for _, char := range characters.Edges {
		character := database.AnimeCharacter{
			Name: database.AnilistName{
				Romaji:        char.Node.Name.Romaji,
				English:       char.Node.Name.English,
				Native:        char.Node.Name.Native,
				UserPreferred: char.Node.Name.UserPreferred,
			},
			Role: char.Role,
			Image: database.AnilistImage{
				ExtraLarge: char.Node.Image.ExtraLarge,
				Large:      char.Node.Image.Large,
				Medium:     char.Node.Image.Medium,
			},
			Description: char.Node.Description,
			Gender:      char.Node.Gender,
			DateOfBirth: database.Date{
				Year:  char.Node.DateOfBirth.Year,
				Month: char.Node.DateOfBirth.Month,
				Day:   char.Node.DateOfBirth.Day,
			},
			Age:       char.Node.Age,
			BloodType: char.Node.BloodType,
		}

		var existingChar database.AnimeCharacter
		if err := tx.Where(&database.AnimeCharacter{
			Name: character.Name,
		}).FirstOrCreate(&existingChar, character).Error; err != nil {
			return fmt.Errorf("find or create character failed: %w", err)
		}

		// Process voice actors
		if err := processVoiceActors(tx, char.VoiceActors, existingChar.ID); err != nil {
			return fmt.Errorf("process voice actors failed: %w", err)
		}

		// Use GORM's default naming convention for the junction table
		if err := tx.Exec("INSERT INTO anime_to_characters (anime_id, anime_character_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
			animeID, existingChar.ID).Error; err != nil {
			return fmt.Errorf("associate character with anime failed: %w", err)
		}
	}

	return nil
}

func convertToInt64Array(input []int) pq.Int64Array {
	result := make([]int64, len(input))
	for i, v := range input {
		result[i] = int64(v)
	}
	return pq.Int64Array(result)
}

func processVoiceActors(tx *gorm.DB, voiceActors []anilistStaff, characterID uint) error {
	for _, va := range voiceActors {
		voiceActor := database.AnimeVoiceActor{
			Name: database.AnilistName{
				Romaji:        va.Name.Romaji,
				English:       va.Name.English,
				Native:        va.Name.Native,
				UserPreferred: va.Name.UserPreferred,
			},
			Language: va.LanguageV2,
			Image: database.AnilistImage{
				ExtraLarge: va.Image.ExtraLarge,
				Large:      va.Image.Large,
				Medium:     va.Image.Medium,
			},
			Description:        va.Description,
			PrimaryOccupations: va.PrimaryOccupations,
			DateOfBirth: database.Date{
				Year:  va.DateOfBirth.Year,
				Month: va.DateOfBirth.Month,
				Day:   va.DateOfBirth.Day,
			},
			DateOfDeath: database.Date{
				Year:  va.DateOfDeath.Year,
				Month: va.DateOfDeath.Month,
				Day:   va.DateOfDeath.Day,
			},
			YearsActive:       convertToInt64Array(va.YearsActive),
			HomeTown:          va.HomeTown,
			BloodType:         va.BloodType,
			AnilistFavourites: va.Favourites,
		}

		var existingVA database.AnimeVoiceActor
		if err := tx.Where(&database.AnimeVoiceActor{
			Name: voiceActor.Name,
		}).FirstOrCreate(&existingVA, voiceActor).Error; err != nil {
			return fmt.Errorf("find or create voice actor failed: %w", err)
		}

		// Use GORM's default naming convention for the junction table
		if err := tx.Exec("INSERT INTO character_to_voice_actors (anime_character_id, anime_voice_actor_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
			characterID, existingVA.ID).Error; err != nil {
			return fmt.Errorf("associate voice actor with character failed: %w", err)
		}
	}

	return nil
}

func processStaff(tx *gorm.DB, staff anilistStaffConnection, animeID uint) error {
	for _, s := range staff.Edges {
		staffMember := database.AnimeStaff{
			Name: database.AnilistName{
				Romaji:        s.Node.Name.Romaji,
				English:       s.Node.Name.English,
				Native:        s.Node.Name.Native,
				UserPreferred: s.Node.Name.UserPreferred,
			},
			Role:     s.Role,
			Language: s.Node.LanguageV2,
			Image: database.AnilistImage{
				ExtraLarge: s.Node.Image.ExtraLarge,
				Large:      s.Node.Image.Large,
				Medium:     s.Node.Image.Medium,
			},
			Description:        s.Node.Description,
			PrimaryOccupations: s.Node.PrimaryOccupations,
			DateOfBirth: database.Date{
				Year:  s.Node.DateOfBirth.Year,
				Month: s.Node.DateOfBirth.Month,
				Day:   s.Node.DateOfBirth.Day,
			},
			DateOfDeath: database.Date{
				Year:  s.Node.DateOfDeath.Year,
				Month: s.Node.DateOfDeath.Month,
				Day:   s.Node.DateOfDeath.Day,
			},
			Age:               s.Node.Age,
			YearsActive:       convertToInt64Array(s.Node.YearsActive),
			HomeTown:          s.Node.HomeTown,
			BloodType:         s.Node.BloodType,
			AnilistFavourites: s.Node.Favourites,
		}

		// Find or create staff member
		var existingStaff database.AnimeStaff
		if err := tx.Where(&database.AnimeStaff{
			Name: staffMember.Name,
		}).FirstOrCreate(&existingStaff, staffMember).Error; err != nil {
			return fmt.Errorf("find or create staff member failed: %w", err)
		}

		// Use GORM's column naming convention
		if err := tx.Exec("INSERT INTO anime_to_staff (anime_id, anime_staff_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
			animeID, existingStaff.ID).Error; err != nil {
			return fmt.Errorf("associate staff with anime failed: %w", err)
		}
	}

	return nil
}

func processGenres(tx *gorm.DB, genres []string, animeID uint) error {
	for _, genreName := range genres {
		genre := database.AnimeGenre{
			Name: genreName,
		}

		// Find or create genre
		var existingGenre database.AnimeGenre
		if err := tx.Where(&database.AnimeGenre{
			Name: genre.Name,
		}).FirstOrCreate(&existingGenre, genre).Error; err != nil {
			return fmt.Errorf("find or create genre failed: %w", err)
		}

		// Associate genre with anime using many-to-many relationship
		if err := tx.Exec("INSERT INTO anime_to_genres (anime_id, anime_genre_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
			animeID, existingGenre.ID).Error; err != nil {
			return fmt.Errorf("associate genre with anime failed: %w", err)
		}
	}

	return nil
}

func processStudios(tx *gorm.DB, studios []anilistStudioEdge, animeID uint) error {
	for _, s := range studios {
		studio := database.AnimeStudio{
			Name:              s.Node.Name,
			IsAnimationStudio: s.Node.IsAnimationStudio,
			SiteURL:           s.Node.SiteURL,
			AnilistFavourites: s.Node.Favourites,
		}

		// Find or create studio
		var existingStudio database.AnimeStudio
		if err := tx.Where(&database.AnimeStudio{
			Name: studio.Name,
		}).FirstOrCreate(&existingStudio, studio).Error; err != nil {
			return fmt.Errorf("find or create studio failed: %w", err)
		}

		// Associate studio with anime using many-to-many relationship
		if err := tx.Exec("INSERT INTO anime_to_studios (anime_id, anime_studio_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
			animeID, existingStudio.ID).Error; err != nil {
			return fmt.Errorf("associate studio with anime failed: %w", err)
		}
	}

	return nil
}

func processTags(tx *gorm.DB, tags []anilistTag, animeID uint) error {
	for _, t := range tags {
		tag := database.AnimeTag{
			Name:        t.Name,
			Description: t.Description,
			Category:    t.Category,
			Rank:        t.Rank,
			IsAdult:     t.IsAdult,
		}

		// Find or create tag
		var existingTag database.AnimeTag
		if err := tx.Where(&database.AnimeTag{
			Name: tag.Name,
		}).FirstOrCreate(&existingTag, tag).Error; err != nil {
			return fmt.Errorf("find or create tag failed: %w", err)
		}

		// Associate tag with anime using many-to-many relationship
		if err := tx.Exec("INSERT INTO anime_to_tags (anime_id, anime_tag_id) VALUES (?, ?) ON CONFLICT DO NOTHING",
			animeID, existingTag.ID).Error; err != nil {
			return fmt.Errorf("associate tag with anime failed: %w", err)
		}
	}

	return nil
}
