package api

import (
	"errors"
	"metachan-api/database"
	"strconv"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

func SearchAnime(c *fiber.Ctx) error {
	query := c.Query("q")
	var limit, page int
	if query == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Query parameter 'q' is required",
		})
	}

	if c.Query("limit") != "" {
		limit, _ = strconv.Atoi(c.Query("limit"))
	} else {
		limit = 10
	}

	if limit > 50 {
		limit = 50
	}

	if c.Query("page") != "" {
		page, _ = strconv.Atoi(c.Query("page"))
		page = page - 1
	} else {
		page = 0
	}

	var animes []database.Anime
	var totalCount int64

	// First get total count without limit/offset
	database.DB.
		Where("romaji ILIKE ? OR english ILIKE ? OR native ILIKE ? OR user_preferred ILIKE ?",
			"%"+query+"%", "%"+query+"%", "%"+query+"%", "%"+query+"%").
		Model(&database.Anime{}).
		Count(&totalCount)

	// Then get paginated results
	result := database.DB.
		Where("romaji ILIKE ? OR english ILIKE ? OR native ILIKE ? OR user_preferred ILIKE ?",
			"%"+query+"%", "%"+query+"%", "%"+query+"%", "%"+query+"%").
		Limit(limit).
		Offset(page * limit).
		Find(&animes)

	hasNextPage := totalCount > int64((page+1)*limit)
	totalPages := int(totalCount) / limit

	if result.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch anime list",
		})
	}

	return c.JSON(fiber.Map{
		"total":      totalCount,
		"hasNext":    hasNextPage,
		"data":       animes,
		"pagination": fiber.Map{"limit": limit, "page": page + 1, "totalPages": totalPages},
	})
}

func GetAnimeWithAnilistID(c *fiber.Ctx) error {
	// Parse anilist ID from params
	anilistID, err := strconv.Atoi(c.Params("anilistId"))
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid Anilist ID format",
		})
	}

	var anime database.Anime
	result := database.DB.
		Preload("Characters.VoiceActors").
		Preload("Staff").
		Preload("Genres").
		Preload("Studios").
		Preload("Tags").
		Preload("ExternalLinks").
		Preload("DirectRelations.TargetAnime").       // Add preload for relations
		Preload("DirectRecommendations.TargetAnime"). // Add preload for recommendations
		Where("anilist = ?", anilistID).
		First(&anime)

	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return c.Status(fiber.StatusNotFound).JSON(fiber.Map{
				"error": "Anime not found",
			})
		}
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"error": "Failed to fetch anime details",
		})
	}

	// Process relations
	relatedAnime := make([]database.Anime, 0, len(anime.DirectRelations))
	for _, relation := range anime.DirectRelations {
		relatedAnime = append(relatedAnime, relation.TargetAnime)
	}
	anime.Relations = relatedAnime

	// Process recommendations
	recommendedAnime := make([]database.Anime, 0, len(anime.DirectRecommendations))
	for _, recommendation := range anime.DirectRecommendations {
		recommendedAnime = append(recommendedAnime, recommendation.TargetAnime)
	}
	anime.Recommendations = recommendedAnime

	// Return success response with anime data
	return c.JSON(fiber.Map{
		"data": anime,
	})
}
