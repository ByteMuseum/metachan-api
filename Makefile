# Variables
BINARY_NAME=metachan
BINARY_BUILD_PATH=bin/$(BINARY_NAME)
MAIN_PATH=metachan/main.go
ENV_FILE=.env

.PHONY: all build clean dev run setup

setup:
	@echo "Setting up environment..."
	@if [ ! -f $(ENV_FILE) ]; then \
		cp .env.example $(ENV_FILE); \
		echo "Created .env file from example"; \
	fi
	go install github.com/air-verse/air@latest
	go mod download
	
build:
	@echo "Building binary..."
	go build -o $(BINARY_BUILD_PATH) $(MAIN_PATH)

clean:
	@echo "Cleaning up..."
	rm -rf bin

dev:
	@echo "Running with air in development mode..."
	air

run:
	@echo "Checking if binary exists..."
	@if [ ! -f $(BINARY_BUILD_PATH) ]; then \
		make build; \
	fi
	@echo "Running binary..."
	$(BINARY_BUILD_PATH)

all: clean setup build
	@echo "Build complete!"