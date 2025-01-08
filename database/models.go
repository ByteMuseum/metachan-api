package database

import (
	"time"

	"github.com/lib/pq"
)

type BaseModel struct {
	ID        uint       `json:"-"`
	CreatedAt time.Time  `json:"-"`
	UpdatedAt time.Time  `json:"-"`
	DeletedAt *time.Time `json:"-" gorm:"index"`
}

type AnilistAnimeFormat string
type AnilistAnimeSource string
type AnimeSeason string
type AnimeSource string
type AnimeStatus string
type TitleType string

const (
	FormatTV      AnilistAnimeFormat = "TV"
	FormatTVShort AnilistAnimeFormat = "TV_SHORT"
	FormatMovie   AnilistAnimeFormat = "MOVIE"
	FormatSpecial AnilistAnimeFormat = "SPECIAL"
	FormatOVA     AnilistAnimeFormat = "OVA"
	FormatONA     AnilistAnimeFormat = "ONA"
	FormatMusic   AnilistAnimeFormat = "MUSIC"
	FormatManga   AnilistAnimeFormat = "MANGA"
	FormatNovel   AnilistAnimeFormat = "NOVEL"
	FormatOneShot AnilistAnimeFormat = "ONE_SHOT"

	AnilistSourceOriginal          AnilistAnimeSource = "ORIGINAL"
	AnilistSourceManga             AnilistAnimeSource = "MANGA"
	AnilistSourceLightNovel        AnilistAnimeSource = "LIGHT_NOVEL"
	AnilistSourceVisualNovel       AnilistAnimeSource = "VISUAL_NOVEL"
	AnilistSourceVideoGame         AnilistAnimeSource = "VIDEO_GAME"
	AnilistSourceOther             AnilistAnimeSource = "OTHER"
	AnilistSourceDoujinshi         AnilistAnimeSource = "DOUJINSHI"
	AnilistSourceAnime             AnilistAnimeSource = "ANIME"
	AnilistSourceWebNovel          AnilistAnimeSource = "WEB_NOVEL"
	AnilistSourceLiveAction        AnilistAnimeSource = "LIVE_ACTION"
	AnilistSourceGame              AnilistAnimeSource = "GAME"
	AnilistSourceComic             AnilistAnimeSource = "COMIC"
	AnilistSourceMultimediaProject AnilistAnimeSource = "MULTIMEDIA_PROJECT"
	AnilistSourcePictureBook       AnilistAnimeSource = "PICTURE_BOOK"

	Winter AnimeSeason = "WINTER"
	Spring AnimeSeason = "SPRING"
	Summer AnimeSeason = "SUMMER"
	Fall   AnimeSeason = "FALL"

	MappingAniDB       AnimeSource = "anidb"
	MappingAnilist     AnimeSource = "anilist"
	MappingAnimePlanet AnimeSource = "animeplanet"
	MappingAniSearch   AnimeSource = "anisearch"
	MappingKitsu       AnimeSource = "kitsu"
	MappingLiveSearch  AnimeSource = "livesearch"
	MappingMyAnimeList AnimeSource = "myanimelist"
	MappingNotifyMoe   AnimeSource = "notifymoe"
	MappingTheMovieDB  AnimeSource = "tmdb"
	MappingTheTVDB     AnimeSource = "tvdb"

	Releasing      AnimeStatus = "RELEASING"
	Finished       AnimeStatus = "FINISHED"
	NotYetReleased AnimeStatus = "NOT_YET_RELEASED"
	Cancelled      AnimeStatus = "CANCELLED"
	Hiatus         AnimeStatus = "HIATUS"

	Primary     TitleType = "primary"
	English     TitleType = "english"
	Native      TitleType = "native"
	Alternative TitleType = "alternative"
)

type Date struct {
	Year  int `json:"year"`
	Month int `json:"month"`
	Day   int `json:"day"`
}

type AnilistName struct {
	Romaji        string `json:"romaji" gorm:"column:romaji"`
	English       string `json:"english" gorm:"column:english"`
	Native        string `json:"native" gorm:"column:native"`
	UserPreferred string `json:"userPreferred" gorm:"column:user_preferred"`
}

type AnilistImage struct {
	ExtraLarge string `json:"extraLarge" gorm:"column:extra_large"`
	Large      string `json:"large" gorm:"column:large"`
	Medium     string `json:"medium" gorm:"column:medium"`
}

type AnimeFormats struct {
	Anilist AnilistAnimeFormat `json:"anilist"`
	Fribb   string             `json:"fribb"`
}

type AnilistAnimeScores struct {
	Average    int `json:"average"`
	Mean       int `json:"mean"`
	Popularity int `json:"popularity"`
	Trending   int `json:"trending"`
	Favourites int `json:"favourites"`
}

type AnimeScores struct {
	AnilistScores AnilistAnimeScores `json:"anilist" gorm:"embedded;prefix:anilist_"`
}

type AnimeMapping struct {
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

type Anime struct {
	BaseModel
	Titles          AnilistName         `json:"titles" gorm:"embedded;prefix:title_"`
	Mappings        AnimeMapping        `json:"mappings" gorm:"embedded;prefix:mappings_"`
	Formats         AnimeFormats        `json:"formats" gorm:"embedded"`
	StartDate       Date                `json:"startDate" gorm:"embedded;prefix:start_"`
	EndDate         Date                `json:"endDate" gorm:"embedded;prefix:end_"`
	Status          AnimeStatus         `json:"status"`
	Description     string              `json:"description" gorm:"type:text"`
	Season          AnimeSeason         `json:"season"`
	SeasonYear      int                 `json:"seasonYear"`
	Duration        int                 `json:"duration"`
	CountryOfOrigin string              `json:"countryOfOrigin"`
	Source          AnilistAnimeSource  `json:"source"`
	Hashtag         string              `json:"hashtag"`
	CoverImage      AnilistImage        `json:"coverImage" gorm:"embedded;prefix:cover_"`
	BannerImage     string              `json:"bannerImage"`
	Color           string              `json:"color"`
	Synonyms        pq.StringArray      `json:"synonyms" gorm:"type:text[]"`
	Scores          AnimeScores         `json:"scores" gorm:"embedded;prefix:score_"`
	Characters      []AnimeCharacter    `json:"characters" gorm:"many2many:anime_to_characters;joinForeignKey:anime_id;joinReferences:anime_character_id"`
	Staff           []AnimeStaff        `json:"staff" gorm:"many2many:anime_to_staff;joinForeignKey:anime_id;joinReferences:anime_staff_id"`
	Genres          []AnimeGenre        `json:"genres" gorm:"many2many:anime_to_genres;joinForeignKey:anime_id;joinReferences:anime_genre_id"`
	Studios         []AnimeStudio       `json:"studios" gorm:"many2many:anime_to_studios;joinForeignKey:anime_id;joinReferences:anime_studio_id"`
	Tags            []AnimeTag          `json:"tags" gorm:"many2many:anime_to_tags;joinForeignKey:anime_id;joinReferences:anime_tag_id"`
	ExternalLinks   []AnimeExternalLink `json:"externalLinks" gorm:"foreignKey:AnimeID"`
	IsAdult         bool                `json:"isAdult"`
}

type AnimeStudio struct {
	BaseModel
	Name              string `json:"name"`
	IsAnimationStudio bool   `json:"isAnimationStudio"`
	SiteURL           string `json:"siteURL"`
	AnilistFavourites int    `json:"anilistFavourites"`
}

type AnimeExternalLink struct {
	BaseModel
	AnimeID  uint   `json:"-"`
	URL      string `json:"url"`
	Site     string `json:"site"`
	Type     string `json:"type"`
	Language string `json:"language"`
	Color    string `json:"color"`
	Icon     string `json:"icon"`
}

type AnimeTag struct {
	BaseModel
	Name        string `json:"name"`
	Description string `json:"description"`
	Category    string `json:"category"`
	Rank        int    `json:"rank"`
	IsAdult     bool   `json:"isAdult"`
}

type AnimeCharacter struct {
	BaseModel
	Name        AnilistName       `json:"name" gorm:"embedded;predix:name_"`
	Role        string            `json:"role"`
	Image       AnilistImage      `json:"image" gorm:"embedded;prefix:image_"`
	Description string            `json:"description" gorm:"type:text"`
	Gender      string            `json:"gender"`
	DateOfBirth Date              `json:"dateOfBirth" gorm:"embedded;prefix:birth_"`
	Age         string            `json:"age"`
	BloodType   string            `json:"bloodType"`
	VoiceActors []AnimeVoiceActor `json:"voiceActors" gorm:"many2many:character_to_voice_actors"`
}

type AnimeStaff struct {
	BaseModel
	Name               AnilistName    `json:"name" gorm:"embedded;predix:name_"`
	Role               string         `json:"role"`
	Language           string         `json:"language"`
	Image              AnilistImage   `json:"image" gorm:"embedded;prefix:image_"`
	Description        string         `json:"description" gorm:"type:text"`
	PrimaryOccupations pq.StringArray `json:"primaryOccupations" gorm:"type:text[]"`
	DateOfBirth        Date           `json:"dateOfBirth" gorm:"embedded;prefix:birth_"`
	DateOfDeath        Date           `json:"dateOfDeath" gorm:"embedded;prefix:death_"`
	Age                int            `json:"age"`
	YearsActive        pq.Int64Array  `json:"yearsActive" gorm:"type:integer[]"`
	HomeTown           string         `json:"homeTown"`
	BloodType          string         `json:"bloodType"`
	AnilistFavourites  int            `json:"anilistFavourites"`
}

type AnimeVoiceActor struct {
	BaseModel
	Name               AnilistName    `json:"name" gorm:"embedded;predix:name_"`
	Language           string         `json:"language"`
	Image              AnilistImage   `json:"image" gorm:"embedded;prefix:image_"`
	Description        string         `json:"description" gorm:"type:text"`
	PrimaryOccupations pq.StringArray `json:"primaryOccupations" gorm:"type:text[]"`
	DateOfBirth        Date           `json:"dateOfBirth" gorm:"embedded;prefix:birth_"`
	DateOfDeath        Date           `json:"dateOfDeath" gorm:"embedded;prefix:death_"`
	Age                int            `json:"age"`
	YearsActive        pq.Int64Array  `json:"yearsActive" gorm:"type:integer[]"`
	HomeTown           string         `json:"homeTown"`
	BloodType          string         `json:"bloodType"`
	AnilistFavourites  int            `json:"anilistFavourites"`
}

type AnimeGenre struct {
	BaseModel
	Name string `json:"name" gorm:"type:varchar(100);uniqueIndex"`
}
