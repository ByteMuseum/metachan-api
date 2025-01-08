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
	setupDatabase()
}

func setupDatabase() {
	db := connectDatabase()
	cleanDatabaseIfDebug(db)
	migrateSchema(db)
	DB = db
}

func connectDatabase() *gorm.DB {
	logger.Infof("Connecting to Database ...")
	db, err := gorm.Open(postgres.Open(config.Config.DSN), &gorm.Config{})
	if err != nil {
		logger.Fatalf("Database connection failed: %v", err)
	}
	logger.Infof("Connected to Database")
	return db
}

func cleanDatabaseIfDebug(db *gorm.DB) {
	if !config.Config.DebugMode.Enabled || !config.Config.DebugMode.CleanDatabaseOnStart {
		return
	}
	logger.Debugf("Cleaning Database ...")
	statements := []string{
		"DROP SCHEMA public CASCADE",
		"CREATE SCHEMA public",
	}
	for _, stmt := range statements {
		if err := db.Exec(stmt).Error; err != nil {
			logger.Fatalf("Schema operation failed: %v", err)
		}
	}
	logger.Debugf("Database cleaned")
}

func migrateSchema(db *gorm.DB) {
	logger.Debugf("AutoMigrating Database ...")
	baseModels := []interface{}{
		&AnimeGenre{},
		&AnimeStaff{},
		&AnimeCharacter{},
		&AnimeStudio{},
		&AnimeTag{},
		&Anime{},
		&CharacterVoiceActor{}, // Add this line to explicitly include the join table
	}
	dependentModels := []interface{}{
		&AnimeStaffJoin{},
		&AnimeGenreJoin{},
		&AnimeCharacterJoin{},
		&AnimeStudioJoin{},
		&AnimeTagJoin{},
		&AnimeMapping{},
		&AnimeTitle{},
		&AnimeExternalLink{},
	}

	// Remove the SetupJoinTable call

	if err := db.AutoMigrate(baseModels...); err != nil {
		logger.Fatalf("Base tables migration failed: %v", err)
	}
	if err := db.AutoMigrate(dependentModels...); err != nil {
		logger.Fatalf("Dependent tables migration failed: %v", err)
	}
	logger.Infof("Database Migration Complete")
}
