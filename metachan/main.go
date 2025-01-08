package main

import (
	"fmt"
	"log"
	"metachan-api/config"
	"metachan-api/router"
	"metachan-api/syncutil"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
)

func main() {
	app := fiber.New(fiber.Config{
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"error": err.Error(),
			})
		},
	})

	router.Initialize(app)

	// Create channel for graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)

	// Start sync in background
	go func() {
		for {
			syncutil.Sync()
			time.Sleep(24 * time.Hour) // Sync daily
		}
	}()

	// Start server in goroutine
	go func() {
		if err := app.Listen(fmt.Sprintf(":%d", config.Config.Port)); err != nil {
			log.Printf("Server error: %v", err)
			quit <- os.Interrupt
		}
	}()

	// Wait for interrupt signal
	<-quit
	log.Println("Shutting down server...")

	// Gracefully shutdown server
	if err := app.Shutdown(); err != nil {
		log.Printf("Server shutdown error: %v", err)
	}
}
