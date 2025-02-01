# MetaChan

Welcome to **MetaChan**. MetaChan is an Anime and Manga metadata API that provides a RESTful interface for accessing metadata for various anime and manga titles. MetaChan best integrates with [MyAnimeList](https://myanimelist.net/) and uses **MAL IDs** as the primary identifier for anime and manga titles. [AniList](https://anilist.co/) is also supported partially and will reverse lookup MAL IDs.

> [!WARNING]  
> I _do not_ provide pre-hosted instances of the MetaChan API. You will need to host your own instance of the API to use it.

## API Documentation

### Health Check

- **URL**: `/health`
- **Method**: `GET`
- **Auth Required**: Yes
- **Auth Type**: Authorization Header
- **Auth Value**: Set `HEALTH_AUTH_TOKEN` in the environment variables.
- **Description**: Returns the health status of the API.
- **Response Codes**:
  - `200 OK`: API is healthy.
  - `500 Internal Server Error`: API is unhealthy.
- **Response Format**:
  ```ts
  {
    status: 'healthy' | 'unhealthy';
    timestamp: string;
    uptime: number;
    memory: {
      used: number;
      total: number;
      free: number;
      usage: number;
    }
    database: {
      status: 'connected' | 'disconnected';
      lastChecked: string;
    }
    tasks: {
      task_name: {
        registered: boolean;
        running: boolean;
        lastRun: string;
        nextRun: string;
      }
    }
  }
  ```

### Top Airing Anime

- **URL**: `/top/airing`
- **Method**: `GET`
- **Auth Required**: No
- **Description**: Returns the top airing anime titles.
- **Response Codes**:
  - `200 OK`: Success.
  - `500 Internal Server Error`: Failure.
