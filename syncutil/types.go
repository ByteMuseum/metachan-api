package syncutil

type StringedOrUnstringedInt struct {
	value int
}

type fribbMapping struct {
	LiveChart   int                     `json:"livechart_id"`
	AnimePlanet string                  `json:"animeplanet_id"`
	AniSearch   int                     `json:"anisearch_id"`
	AniDB       int                     `json:"anidb_id"`
	Kitsu       int                     `json:"kitsu_id"`
	MAL         int                     `json:"mal_id"`
	NotifyMoe   string                  `json:"notify.moe_id"`
	Anilist     int                     `json:"anilist_id"`
	TVDB        int                     `json:"thetvdb_id"`
	IMDB        string                  `json:"imdb_id"`
	TMDB        StringedOrUnstringedInt `json:"themoviedb_id"`
	Type        string                  `json:"type"`
}

type anilistName struct {
	Romaji        string `json:"romaji"`
	English       string `json:"english"`
	Native        string `json:"native"`
	UserPreferred string `json:"userPreferred,omitempty"`
}

type anilistDate struct {
	Year  int `json:"year"`
	Month int `json:"month"`
	Day   int `json:"day"`
}

type anilistImage struct {
	ExtraLarge string `json:"extraLarge,omitempty"`
	Large      string `json:"large"`
	Medium     string `json:"medium"`
	Color      string `json:"color,omitempty"`
}

type anilistTag struct {
	ID             int    `json:"id"`
	Name           string `json:"name"`
	Description    string `json:"description"`
	Category       string `json:"category"`
	Rank           int    `json:"rank"`
	IsGeneralSpoil bool   `json:"isGeneralSpoiler"`
	IsMediaSpoiler bool   `json:"isMediaSpoiler"`
	IsAdult        bool   `json:"isAdult"`
}

type anilistCharacter struct {
	ID          int          `json:"id"`
	Name        anilistName  `json:"name"`
	Image       anilistImage `json:"image"`
	Description string       `json:"description"`
	Gender      string       `json:"gender"`
	DateOfBirth anilistDate  `json:"dateOfBirth"`
	Age         string       `json:"age"`
	BloodType   string       `json:"bloodType"`
}

type anilistVoiceActor struct {
	ID         int          `json:"id"`
	Name       anilistName  `json:"name"`
	LanguageV2 string       `json:"languageV2"`
	Image      anilistImage `json:"image"`
}

type anilistCharacterEdge struct {
	ID          int                 `json:"id"`
	Role        string              `json:"role"`
	Name        string              `json:"name"`
	VoiceActors []anilistVoiceActor `json:"voiceActors"`
	Node        anilistCharacter    `json:"node"`
}

type anilistCharacterConnection struct {
	Edges []anilistCharacterEdge `json:"edges"`
}

type anilistStaff struct {
	ID                 int          `json:"id"`
	Name               anilistName  `json:"name"`
	LanguageV2         string       `json:"languageV2"`
	Image              anilistImage `json:"image"`
	Description        string       `json:"description"`
	PrimaryOccupations []string     `json:"primaryOccupations"`
	DateOfBirth        anilistDate  `json:"dateOfBirth"`
	DateOfDeath        anilistDate  `json:"dateOfDeath"`
	Age                int          `json:"age"`
	YearsActive        []int        `json:"yearsActive"`
	HomeTown           string       `json:"homeTown"`
}

type anilistStaffEdge struct {
	ID   int          `json:"id"`
	Role string       `json:"role"`
	Node anilistStaff `json:"node"`
}

type anilistStaffConnection struct {
	Edges []anilistStaffEdge `json:"edges"`
}

type anilistStudio struct {
	ID                int    `json:"id"`
	Name              string `json:"name"`
	IsAnimationStudio bool   `json:"isAnimationStudio"`
	SiteURL           string `json:"siteUrl"`
	Favourites        int    `json:"favourites"`
}

type anilistStudioEdge struct {
	ID     int           `json:"id"`
	IsMain bool          `json:"isMain"`
	Node   anilistStudio `json:"node"`
}

type anilistStudioConnection struct {
	Edges []anilistStudioEdge `json:"edges"`
}

type anilistExternalLink struct {
	ID       int    `json:"id"`
	URL      string `json:"url"`
	Site     string `json:"site"`
	Type     string `json:"type"`
	Language string `json:"language"`
	Color    string `json:"color"`
	Icon     string `json:"icon"`
}

type anilistRanking struct {
	ID      int    `json:"id"`
	Rank    int    `json:"rank"`
	Type    string `json:"type"`
	Format  string `json:"format"`
	Year    int    `json:"year"`
	Season  string `json:"season"`
	AllTime bool   `json:"allTime"`
	Context string `json:"context"`
}

type anilistRecommendation struct {
	ID                  int           `json:"id"`
	Rating              int           `json:"rating"`
	MediaRecommendation *anilistMedia `json:"mediaRecommendation"`
}

type anilistRecommendationEdge struct {
	Node anilistRecommendation `json:"node"`
}

type anilistRecommendationConnection struct {
	Edges []anilistRecommendationEdge `json:"edges"`
}

type anilistScoreDistribution struct {
	Score  int `json:"score"`
	Amount int `json:"amount"`
}

type anilistStatusDistribution struct {
	Status string `json:"status"`
	Amount int    `json:"amount"`
}

type anilistStats struct {
	ScoreDistribution  []anilistScoreDistribution  `json:"scoreDistribution"`
	StatusDistribution []anilistStatusDistribution `json:"statusDistribution"`
}

type anilistTrendNode struct {
	Date       int  `json:"date"`
	Trending   int  `json:"trending"`
	Popularity int  `json:"popularity"`
	InProgress int  `json:"inProgress"`
	Releasing  bool `json:"releasing"`
	Episode    int  `json:"episode"`
}

type anilistTrendEdge struct {
	Node anilistTrendNode `json:"node"`
}

type anilistTrendConnection struct {
	Edges []anilistTrendEdge `json:"edges"`
}

type anilistTrailer struct {
	ID        string `json:"id"`
	Site      string `json:"site"`
	Thumbnail string `json:"thumbnail"`
}

type anilistRelationEdge struct {
	ID           int           `json:"id"`
	RelationType string        `json:"relationType"`
	Node         *anilistMedia `json:"node"`
}

type anilistRelationConnection struct {
	Edges []anilistRelationEdge `json:"edges"`
}

// Main media struct that contains all the anime information
type anilistMedia struct {
	ID              int                             `json:"id"`
	IDMal           int                             `json:"idMal"`
	Title           anilistName                     `json:"title"`
	Type            string                          `json:"type"`
	Format          string                          `json:"format"`
	Status          string                          `json:"status"`
	Description     string                          `json:"description"`
	StartDate       anilistDate                     `json:"startDate"`
	EndDate         anilistDate                     `json:"endDate"`
	Season          string                          `json:"season"`
	SeasonYear      int                             `json:"seasonYear"`
	Episodes        int                             `json:"episodes"`
	Duration        int                             `json:"duration"`
	Chapters        int                             `json:"chapters"`
	Volumes         int                             `json:"volumes"`
	CountryOfOrigin string                          `json:"countryOfOrigin"`
	IsLicensed      bool                            `json:"isLicensed"`
	Source          string                          `json:"source"`
	Hashtag         string                          `json:"hashtag"`
	Trailer         anilistTrailer                  `json:"trailer"`
	UpdatedAt       int                             `json:"updatedAt"`
	CoverImage      anilistImage                    `json:"coverImage"`
	BannerImage     string                          `json:"bannerImage"`
	Genres          []string                        `json:"genres"`
	Synonyms        []string                        `json:"synonyms"`
	AverageScore    int                             `json:"averageScore"`
	MeanScore       int                             `json:"meanScore"`
	Popularity      int                             `json:"popularity"`
	IsLocked        bool                            `json:"isLocked"`
	Trending        int                             `json:"trending"`
	Favourites      int                             `json:"favourites"`
	Tags            []anilistTag                    `json:"tags"`
	Relations       anilistRelationConnection       `json:"relations"`
	Characters      anilistCharacterConnection      `json:"characters"`
	Staff           anilistStaffConnection          `json:"staff"`
	Studios         anilistStudioConnection         `json:"studios"`
	ExternalLinks   []anilistExternalLink           `json:"externalLinks"`
	Rankings        []anilistRanking                `json:"rankings"`
	Recommendations anilistRecommendationConnection `json:"recommendations"`
	Stats           anilistStats                    `json:"stats"`
	IsAdult         bool                            `json:"isAdult"`
	Trends          anilistTrendConnection          `json:"trends"`
}

type anilistResponse struct {
	Data struct {
		Media *anilistMedia `json:"Media"`
	} `json:"data"`
	Errors []struct {
		Message string `json:"message"`
		Status  int    `json:"status"`
	} `json:"errors,omitempty"`
}

type anilistRequest struct {
	Query     string         `json:"query"`
	Variables map[string]any `json:"variables"`
}
