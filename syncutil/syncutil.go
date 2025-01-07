package syncutil

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"io"
	"metachan-api/config"
	"metachan-api/database"
	"metachan-api/utils/log"
	"net/http"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

//go:embed queries/anilist.graphql
var anilistQuery string

var logger = log.NewLogger(log.WithLevelInt(config.Config.LogLevel))

const (
	anilistAPIURL     = "https://graphql.anilist.co"
	requestsPerMinute = 90
)

type rateLimiter struct {
	ticker *time.Ticker
}

func newRateLimiter() *rateLimiter {
	interval := time.Minute / time.Duration(requestsPerMinute)
	return &rateLimiter{
		ticker: time.NewTicker(interval),
	}
}

func (rl *rateLimiter) wait() {
	<-rl.ticker.C
}

func Sync() {
	logger.Infof("SyncUtil Sync Started ...")
	logger.Debugf("Fetching Anime List Mappings ...")

	mappings := fetchAnimeListMappings()
	if mappings == nil {
		logger.Errorf("Failed to fetch anime mappings")
		return
	}

	logger.Debugf("Successfully fetched %d anime mappings", len(mappings))
	logger.Debugf("Starting Anilist data sync...")

	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	limiter := newRateLimiter()
	defer limiter.ticker.Stop()

	var (
		processedCount int
		errorCount     int
		validCount     int
	)

	for _, mapping := range mappings {
		if mapping.Anilist == 0 {
			continue
		}
		validCount++

		limiter.wait()

		logger.Debugf("Processing Anilist ID: %d (%d/%d)", mapping.Anilist, validCount, len(mappings))

		media, err := fetchAnimeFromAnilist(client, mapping.Anilist)
		if err != nil {
			logger.Errorf("Failed to fetch anime ID %d: %v", mapping.Anilist, err)
			errorCount++
			continue
		}

		logger.Debugf("Fetched Anilist ID: %d. Start Date: %d-%d-%d, End Date: %d-%d-%d", mapping.Anilist, media.StartDate.Year, media.StartDate.Month, media.StartDate.Day, media.EndDate.Year, media.EndDate.Month, media.EndDate.Day)
		if mapping.MAL == 0 || mapping.MAL != media.IDMal {
			logger.Debugf("MAL ID mismatch: %d != %d. Setting MAL ID to %d", mapping.MAL, media.IDMal, media.IDMal)
			mapping.MAL = media.IDMal
		}
		baseAnime := database.Anime{
			Titles: []database.AnimeTitle{
				{
					Type:  database.Primary,
					Title: media.Title.UserPreferred,
				},
				{
					Type:  database.English,
					Title: media.Title.English,
				},
				{
					Type:  database.Native,
					Title: media.Title.Native,
				},
				{
					Type:  database.Alternative,
					Title: media.Title.Romaji,
				},
			},
			Mappings: []database.AnimeMapping{
				{
					AniDB:       mapping.AniDB,
					Anilist:     mapping.Anilist,
					AnimePlanet: mapping.AnimePlanet,
					AniSearch:   mapping.AniSearch,
					Kitsu:       mapping.Kitsu,
					LiveChart:   mapping.LiveChart,
					MyAnimeList: mapping.MAL,
					NotifyMoe:   mapping.NotifyMoe,
					TheMovieDB:  mapping.TMDB.value,
					TheTVDB:     mapping.TVDB,
				},
			},
			Formats: database.AnimeFormats{
				Anilist: convertAnilistMediaFormatToDatabaseEquivalent(media.Format),
				Fribb:   mapping.Type,
			},
			StartDate: database.Date{
				Year:  media.StartDate.Year,
				Month: media.StartDate.Month,
				Day:   media.StartDate.Day,
			},
			EndDate: database.Date{
				Year:  media.EndDate.Year,
				Month: media.EndDate.Month,
				Day:   media.EndDate.Day,
			},
		}

		if err := database.DB.Create(&baseAnime).Error; err != nil {
			logger.Errorf("Failed to create anime: %v", err)
			errorCount++
			continue
		}

		processedCount++
		if processedCount%100 == 0 {
			logger.Infof("Progress: %d/%d processed", processedCount, validCount)
		}

		if processedCount == 10 {
			break // For testing
		}
	}

	logger.Infof("Sync completed. Processed: %d, Errors: %d", processedCount, errorCount)
}

func fetchAnimeFromAnilist(client *http.Client, id int) (*anilistMedia, error) {
	variables := map[string]any{
		"id": id,
	}

	reqBody := anilistRequest{
		Query:     anilistQuery,
		Variables: variables,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", anilistAPIURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		return nil, err
	}

	var aniResp anilistResponse
	if err := json.Unmarshal(body, &aniResp); err != nil {
		return nil, err
	}

	if len(aniResp.Errors) > 0 {
		return nil, err
	}

	if aniResp.Data.Media == nil {
		return nil, err
	}

	return aniResp.Data.Media, nil
}

func convertAnilistMediaFormatToDatabaseEquivalent(mediaFormat string) database.AnilistAnimeFormat {
	switch mediaFormat {
	case "TV":
		return database.TV
	case "TV_SHORT":
		return database.TVShort
	case "MOVIE":
		return database.Movie
	case "SPECIAL":
		return database.Special
	case "OVA":
		return database.OVA
	case "ONA":
		return database.ONA
	case "MUSIC":
		return database.Music
	case "MANGA":
		return database.Manga
	case "NOVEL":
		return database.Novel
	case "ONE_SHOT":
		return database.OneShot
	default:
		return database.TV
	}
}

func createOrUpdateAnime(db *gorm.DB, anime *database.Anime) error {
	return db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "anilist"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"formats",
			"start_date",
			"end_date",
			"updated_at",
		}),
	}).Create(anime).Error
}

func fetchAnimeListMappings() []*fribbMapping {
	RAW_URL := "https://raw.githubusercontent.com/Fribb/anime-lists/refs/heads/master/anime-list-full.json"
	logger.Debugf("Raw URL Configured as: %s", RAW_URL)

	resp, err := http.Get(RAW_URL)
	if err != nil {
		return nil
	}
	defer resp.Body.Close()

	var mappings []*fribbMapping
	if err := json.NewDecoder(resp.Body).Decode(&mappings); err != nil {
		logger.Errorf("Failed to decode anime mappings: %v", err)
		return nil
	}

	return mappings
}
