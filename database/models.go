package database

import (
	"time"

	"gorm.io/gorm"
)

type AnilistAnimeFormat string

const (
	TV      AnilistAnimeFormat = "TV"
	TVShort AnilistAnimeFormat = "TV_SHORT"
	Movie   AnilistAnimeFormat = "MOVIE"
	Special AnilistAnimeFormat = "SPECIAL"
	OVA     AnilistAnimeFormat = "OVA"
	ONA     AnilistAnimeFormat = "ONA"
	Music   AnilistAnimeFormat = "MUSIC"
	Manga   AnilistAnimeFormat = "MANGA"
	Novel   AnilistAnimeFormat = "NOVEL"
	OneShot AnilistAnimeFormat = "ONE_SHOT"
)

type AnimeSource string

const (
	AniDB       AnimeSource = "anidb"
	Anilist     AnimeSource = "anilist"
	AnimePlanet AnimeSource = "animeplanet"
	AniSearch   AnimeSource = "anisearch"
	Kitsu       AnimeSource = "kitsu"
	LiveSearch  AnimeSource = "livesearch"
	MyAnimeList AnimeSource = "myanimelist"
	NotifyMoe   AnimeSource = "notifymoe"
	TheMovieDB  AnimeSource = "tmdb"
	TheTVDB     AnimeSource = "tvdb"
)

type TitleType string

const (
	Primary     TitleType = "primary"
	English     TitleType = "english"
	Native      TitleType = "native"
	Alternative TitleType = "alternative"
)

type Anime struct {
	ID        uint           `gorm:"primarykey" json:"-"`
	CreatedAt time.Time      `json:"-"`
	UpdatedAt time.Time      `json:"-"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Titles   []AnimeTitle   `json:"titles"`
	Mappings []AnimeMapping `json:"mappings"`
	Formats  AnimeFormats   `json:"formats" gorm:"embedded"`

	StartDate Date `json:"startDate" gorm:"embedded;embeddedPrefix:start_"`
	EndDate   Date `json:"endDate" gorm:"embedded;embeddedPrefix:end_"`
}

type AnimeFormats struct {
	Anilist AnilistAnimeFormat `json:"anilist"`
	Fribb   string             `json:"fribb"`
}

type AnimeMapping struct {
	ID          uint   `gorm:"primarykey" json:"-"`
	AnimeID     uint   `json:"-"`
	AniDB       int    `json:"anidb,omitempty"`
	Anilist     int    `json:"anilist,omitempty"`
	AnimePlanet string `json:"animePlanet,omitempty"`
	AniSearch   int    `json:"aniSearch,omitempty"`
	Kitsu       int    `json:"kitsu,omitempty"`
	LiveChart   int    `json:"liveChart,omitempty"`
	MyAnimeList int    `json:"myAnimeList,omitempty"`
	NotifyMoe   string `json:"notifyMoe,omitempty"`
	TheMovieDB  int    `json:"theMovieDB,omitempty"`
	TheTVDB     int    `json:"theTVDB,omitempty"`
}

type AnimeTitle struct {
	ID      uint      `gorm:"primarykey" json:"-"`
	AnimeID uint      `json:"-"`
	Type    TitleType `json:"type"`
	Title   string    `json:"title"`
}

type Date struct {
	Year  int `json:"year" gorm:"column:year"`
	Month int `json:"month" gorm:"column:month"`
	Day   int `json:"day" gorm:"column:day"`
}
