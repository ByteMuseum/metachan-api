package router

import (
	"metachan-api/api"

	"github.com/gofiber/fiber/v2"
)

func Initialize(router *fiber.App) {
	animeRouter := router.Group("/anime")
	animeRouter.Get("/search", api.SearchAnime)
	animeRouter.Get("/anilist/:anilistId", api.GetAnimeWithAnilistID)
}
