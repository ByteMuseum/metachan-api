package database

import (
	"metachan-api/config"
	"metachan-api/utils/log"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var (
	DB     *gorm.DB
	logger = log.NewLogger(log.WithLevelInt(config.Config.LogLevel))
)

func init() {
	connectDB()
	handleDatabaseCleanup()
	migrateSchema()
}

func connectDB() {
	logger.Infof("Connecting to Database ...")
	logger.Debugf("DSN: %s", config.Config.DSN)

	db, err := gorm.Open(postgres.Open(config.Config.DSN), &gorm.Config{})
	if err != nil {
		logger.Fatalf("Failed to connect to database: %v", err)
	}

	DB = db
	logger.Infof("Connected to Database")
}

func handleDatabaseCleanup() {
	if !config.Config.DebugMode.Enabled {
		if config.Config.DebugMode.CleanDatabaseOnStart {
			logger.Warnf("Database cleanup ignored: DebugMode disabled")
		}
		return
	}

	if !config.Config.DebugMode.CleanDatabaseOnStart {
		return
	}

	logger.Debugf("Cleaning Database ...")
	if err := DB.Exec("DROP SCHEMA public CASCADE").Error; err != nil {
		logger.Fatalf("Schema drop failed: %v", err)
	}

	if err := DB.Exec("CREATE SCHEMA public").Error; err != nil {
		logger.Fatalf("Schema creation failed: %v", err)
	}

	logger.Debugf("Database cleaned")
}

func migrateSchema() {
	logger.Debugf("AutoMigrating Database ...")

	if err := DB.AutoMigrate(
		&Anime{},
		&AnimeMapping{},
		&AnimeTitle{},
	); err != nil {
		logger.Fatalf("Migration failed: %v", err)
	}

	logger.Infof("Database Migration Complete")
}
