package config

import (
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

type Configuration struct {
	LogLevel  int
	DSN       string
	DebugMode struct {
		Enabled              bool
		CleanDatabaseOnStart bool
	}
}

var Config = &Configuration{
	LogLevel: logLevels["info"],
	DSN:      "host=localhost user=postgres password=postgres dbname=postgres port=5432 sslmode=disable TimeZone=UTC",
	DebugMode: struct {
		Enabled              bool
		CleanDatabaseOnStart bool
	}{
		Enabled:              false,
		CleanDatabaseOnStart: false,
	},
}

var logLevels = map[string]int{
	"debug": 0,
	"info":  1,
	"warn":  2,
	"error": 3,
	"fatal": 4,
}

func init() {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found")
	}
	Load()
}

func Load() {
	logLevel := os.Getenv("LOG_LEVEL")
	if level, exists := logLevels[strings.ToLower(logLevel)]; exists {
		Config.LogLevel = level
	} else {
		Config.LogLevel = logLevels["info"]
	}

	dbHost := os.Getenv("DB_HOST")
	dbUser := os.Getenv("DB_USER")
	dbPassword := os.Getenv("DB_PASSWORD")
	dbName := os.Getenv("DB_NAME")
	dbPort, _ := strconv.Atoi(os.Getenv("DB_PORT"))
	dbSSLMode := os.Getenv("DB_SSLMODE")
	dbTimezone := os.Getenv("DB_TIMEZONE")
	Config.DSN = dsnBuilder(dbHost, dbUser, dbPassword, dbName, dbPort, dbSSLMode, dbTimezone)

	debugMode := os.Getenv("DEBUG_MODE")
	if strings.ToLower(debugMode) == "true" {
		Config.DebugMode.Enabled = true
		Config.LogLevel = logLevels["debug"]
	}

	cleanDatabaseOnStart := os.Getenv("CLEAN_DATABASE_ON_START")
	if strings.ToLower(cleanDatabaseOnStart) == "true" {
		Config.DebugMode.CleanDatabaseOnStart = true
	}
}

func dsnBuilder(host string, user, password, dbname string, port int, sslmode, timezone string) string {
	var dsn strings.Builder
	dsn.WriteString("host=")
	dsn.WriteString(host)
	dsn.WriteString(" user=")
	dsn.WriteString(user)
	if password != "" {
		dsn.WriteString(" password=")
		dsn.WriteString(password)
	}
	dsn.WriteString(" dbname=")
	dsn.WriteString(dbname)
	if port != 0 {
		dsn.WriteString(" port=")
		dsn.WriteString(strconv.Itoa(port))
	} else {
		dsn.WriteString(" port=5432")
	}
	if sslmode != "" {
		dsn.WriteString(" sslmode=")
		dsn.WriteString(sslmode)
	} else {
		dsn.WriteString(" sslmode=disable")
	}
	if timezone != "" {
		dsn.WriteString(" TimeZone=")
		dsn.WriteString(timezone)
	} else {
		dsn.WriteString(" TimeZone=UTC")
	}

	return dsn.String()
}
