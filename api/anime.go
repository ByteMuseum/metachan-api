package api

import (
	"errors"
	"metachan-api/database"
	"strconv"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

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
		Preload("Characters.VoiceActors"). // Load characters and their voice actors
		Preload("Staff").                  // Load staff members
		Preload("Genres").                 // Load genres
		Preload("Studios").                // Load studios
		Preload("Tags").                   // Load tags
		Preload("ExternalLinks").          // Load external links
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

	// Return success response with anime data
	return c.JSON(fiber.Map{
		"data": anime,
	})
}
