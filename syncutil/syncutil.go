package syncutil

import (
	"bytes"
	_ "embed"
	"encoding/json"
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

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
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
	baseRetryDelaySeconds = 60
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
	media, err := fetchAnimeData(client, mapping.Anilist)
	if err != nil {
		return fmt.Errorf("fetch failed: %w", err)
	}

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
	logger.Debugf("Processing mapping %s | Title: %s", pad(mapping.Anilist, 6), title)

	return database.DB.Transaction(func(tx *gorm.DB) error {
		anime := buildAnimeModel(media, mapping)

		if err := tx.Create(&anime).Error; err != nil {
			return fmt.Errorf("create anime failed: %w", err)
		}

		if err := processCharacters(tx, media.Characters, anime.ID); err != nil {
			return fmt.Errorf("process characters failed: %w", err)
		}

		if err := processStaff(tx, media.Staff, anime.ID); err != nil {
			return fmt.Errorf("process staff failed: %w", err)
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

func buildTitles(title anilistName) []database.AnimeTitle {
	return []database.AnimeTitle{
		{Type: database.Primary, Title: title.UserPreferred},
		{Type: database.English, Title: title.English},
		{Type: database.Native, Title: title.Native},
		{Type: database.Alternative, Title: title.Romaji},
	}
}

func buildMappings(mapping *fribbMapping, malID int) []database.AnimeMapping {
	return []database.AnimeMapping{{
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
	}}
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

func processCharacters(tx *gorm.DB, chars anilistCharacterConnection, animeID uint) error {
	for _, edge := range chars.Edges {
		char := buildCharacter(edge.Node)
		if err := createOrUpdateCharacter(tx, &char); err != nil {
			return err
		}

		if err := linkCharacterToAnime(tx, char.ID, animeID, edge.Role); err != nil {
			return err
		}

		if err := processVoiceActors(tx, edge.VoiceActors, char.ID); err != nil {
			return err
		}
	}
	return nil
}

func processStaff(tx *gorm.DB, staff anilistStaffConnection, animeID uint) error {
	for _, edge := range staff.Edges {
		staffMember := buildStaffMember(edge.Node)
		if err := createOrUpdateStaff(tx, &staffMember); err != nil {
			return err
		}

		if err := linkStaffToAnime(tx, staffMember.ID, animeID, edge.Role); err != nil {
			return err
		}
	}
	return nil
}

func processVoiceActors(tx *gorm.DB, actors []anilistStaff, charID uint) error {
	for _, va := range actors {
		staff := buildStaffMember(anilistStaff(va))
		if err := createOrUpdateStaff(tx, &staff); err != nil {
			return err
		}

		if err := linkVoiceActorToCharacter(tx, staff.ID, charID, va.LanguageV2); err != nil {
			return err
		}
	}
	return nil
}

func buildCharacter(node anilistCharacter) database.AnimeCharacter {
	return database.AnimeCharacter{
		Name:        convertName(node.Name),
		Image:       convertImage(node.Image),
		Description: node.Description,
		Gender:      node.Gender,
		DateOfBirth: convertDate(node.DateOfBirth),
		BloodType:   node.BloodType,
	}
}

func buildStaffMember(node anilistStaff) database.AnimeStaff {
	return database.AnimeStaff{
		Name:               convertName(node.Name),
		Language:           node.LanguageV2,
		Image:              convertImage(node.Image),
		Description:        node.Description,
		PrimaryOccupations: node.PrimaryOccupations,
		DateOfBirth:        convertDate(node.DateOfBirth),
		DateOfDeath:        convertDate(node.DateOfDeath),
		Age:                node.Age,
		YearsActive:        convertToInt64Array(node.YearsActive),
		HomeTown:           node.HomeTown,
		BloodType:          node.BloodType,
		AnilistFavourites:  node.Favourites,
	}
}

func convertName(name anilistName) database.AnilistName {
	return database.AnilistName{
		Romaji:        name.Romaji,
		English:       name.English,
		Native:        name.Native,
		UserPreferred: name.UserPreferred,
	}
}

func convertToInt64Array(input []int) []int64 {
	result := make([]int64, len(input))
	for i, v := range input {
		result[i] = int64(v)
	}
	return result
}

func createOrUpdateCharacter(tx *gorm.DB, char *database.AnimeCharacter) error {
	// Use raw SQL to query the nested JSON field
	query := `
        SELECT id FROM anime_characters 
        WHERE 
            (name->>'native' = ? OR name->>'romaji' = ? OR name->>'english' = ? OR name->>'user_preferred' = ?)
    `
	var existingID uint
	err := tx.Raw(query,
		char.Name.Native,
		char.Name.Romaji,
		char.Name.English,
		char.Name.UserPreferred,
	).Scan(&existingID).Error

	if err == nil && existingID != 0 {
		char.ID = existingID
		return nil
	}

	if err != nil && err != gorm.ErrRecordNotFound {
		return fmt.Errorf("character lookup failed: %w", err)
	}

	return tx.Create(char).Error
}

func createOrUpdateStaff(tx *gorm.DB, staff *database.AnimeStaff) error {
	// Use raw SQL to query the nested JSON field
	query := `
        SELECT id FROM anime_staffs 
        WHERE 
            (name->>'native' = ? OR name->>'romaji' = ? OR name->>'english' = ? OR name->>'user_preferred' = ?)
    `
	var existingID uint
	err := tx.Raw(query,
		staff.Name.Native,
		staff.Name.Romaji,
		staff.Name.English,
		staff.Name.UserPreferred,
	).Scan(&existingID).Error

	if err == nil && existingID != 0 {
		staff.ID = existingID
		return nil
	}

	if err != nil && err != gorm.ErrRecordNotFound {
		return fmt.Errorf("staff lookup failed: %w", err)
	}

	return tx.Create(staff).Error
}

func linkCharacterToAnime(tx *gorm.DB, charID, animeID uint, role string) error {
	characterJoin := database.AnimeCharacterJoin{
		AnimeID:          animeID,
		AnimeCharacterID: charID,
		Role:             role,
	}
	return tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "anime_id"}, {Name: "anime_character_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"role"}),
	}).Create(&characterJoin).Error
}

func linkStaffToAnime(tx *gorm.DB, staffID, animeID uint, role string) error {
	staffJoin := database.AnimeStaffJoin{
		AnimeID:      animeID,
		AnimeStaffID: staffID,
		Role:         role,
	}
	return tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "anime_id"}, {Name: "anime_staff_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"role"}),
	}).Create(&staffJoin).Error
}

func linkVoiceActorToCharacter(tx *gorm.DB, actorID, charID uint, language string) error {
	voiceActor := database.CharacterVoiceActor{
		CharacterID:  charID,
		VoiceActorID: actorID,
		Language:     language,
	}
	return tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "character_id"}, {Name: "voice_actor_id"}},
		DoUpdates: clause.AssignmentColumns([]string{"language"}),
	}).Create(&voiceActor).Error
}
