# MetaChan

Welcome to **MetaChan**. MetaChan is an Anime and Manga metadata API that provides a RESTful interface for accessing metadata for various anime and manga titles. MetaChan best integrates with [MyAnimeList](https://myanimelist.net/) and uses **MAL IDs** as the primary identifier for anime and manga titles. [AniList](https://anilist.co/) is also supported partially and will reverse lookup MAL IDs.

> [!WARNING]  
> I _do not_ provide pre-hosted instances of the MetaChan API. You will need to host your own instance of the API to use it.

> [!CAUTION]
> The API is still under **heavy development** and the `main` branch contains breaking changes. A lot of features are still missing and the Documentation is not complete. There are *no releases* yet. If you still want to use the API, you can build it from the source code or use the Dockerfile provided.

## Build/Run Instructions

You can either build a [Docker](https://www.docker.com/) image or run the API directly using [Node.js](https://nodejs.org/). The API uses a `sqlite` database to store, update, cache, and retrieve metadata. A [Dockerfile](./Dockerfile) is provided to build a Docker image.

### Environment Variables

Following environment variables should be configured before running the API:

```bash
NODE_ENV=production # or development. development enables debug logs.
TVDB_API_KEY= # The TVDB API key.
HEALTH_AUTH_TOKEN= # The health check endpoint authorization token. Configure this to secure the health check endpoint.
CONSUMET_URL= # The URL to a self-hosted Consumet instance.
```

Information on the [Consumet API](https://docs.consumet.org/) can be found [here](https://docs.consumet.org/) or refer to the [`@consumet/extensions`](https://npmjs.com/package/@consumet/extensions) package.

> [!NOTE]  
> The dependency on the [Consumet API](https://docs.consumet.org/) might be removed in the future. The current API will work without it, but some information might be missing.

### Docker

To build a Docker image, run the following command:

```bash
docker build -t metachan .
```

To run the Docker image, run the following command:

```bash
docker run -d -p 3000:3000 --name metachan metachan
```

### Node.js

To run the API using Node.js, run the following commands:

```bash
npm install
npm run build
npm start
```

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
- **Response Interface**: [`HealthStatus`](#HealthStatus)

### Top Airing Anime

- **URL**: `/top/airing`
- **Method**: `GET`
- **Auth Required**: No
- **Query Params**:
  - `page`: `number` - The page number.
  - `limit`: `number` - The number of results per page.
- **Description**: Returns the top airing anime titles.
- **Response Codes**:
  - `200 OK`: Success.
  - `500 Internal Server Error`: Failure.
- **Response Interface**: [`AnimeSearchResult`](#AnimeSearchResult)

### Top Upcoming Anime

- **URL**: `/top/upcoming`
- **Method**: `GET`
- **Auth Required**: No
- **Query Params**:
  - `page`: `number` - The page number.
  - `limit`: `number` - The number of results per page.
- **Description**: Returns the top upcoming anime titles.
- **Response Codes**:
  - `200 OK`: Success.
  - `500 Internal Server Error`: Failure.
- **Response Interface**: [`AnimeSearchResult`](#AnimeSearchResult)

### Top Popular Anime

- **URL**: `/top/popular`
- **Method**: `GET`
- **Auth Required**: No
- **Query Params**:
  - `page`: `number` - The page number.
  - `limit`: `number` - The number of results per page.
- **Description**: Returns the top popular anime titles.
- **Response Codes**:
  - `200 OK`: Success.
  - `500 Internal Server Error`: Failure.
- **Response Interface**: [`AnimeSearchResult`](#AnimeSearchResult)

### Top Favorite Anime

- **URL**: `/top/favorite`
- **Method**: `GET`
- **Auth Required**: No
- **Query Params**:
  - `page`: `number` - The page number.
  - `limit`: `number` - The number of results per page.
- **Description**: Returns the top favorite anime titles.
- **Response Codes**:
  - `200 OK`: Success.
  - `500 Internal Server Error`: Failure.
- **Response Interface**: [`AnimeSearchResult`](#AnimeSearchResult)

### Anime Search

- **URL**: `/anime/search`
- **Method**: `GET`
- **Auth Required**: No
- **Query Params**:
  - `q`: `string` - The search query.
  - `page`: `number` - The page number.
  - `limit`: `number` - The number of results per page.
  - `type`: `enum` - The type of search. Possible values: `tv`, `movie`, `ova`, `special`, `ona`, `music`, `cm`, `pv`, `tv_special`.
  - `score`: `number` - Anime score.
  - `min_score`: `number` - Minimum anime score.
  - `max_score`: `number` - Maximum anime score.
  - `status`: `enum` - The status of the anime. Possible values: `airing`, `completed`, `upcoming`.
  - `rating`: `enum` - The rating of the anime. Possible values: `g`, `pg`, `pg13`, `r17`, `r`, `rx`.
  - `sfw`: `boolean` - Whether the anime is safe for work.
  - `genres`: `string` - Comma separated list of genres IDs
  - `genres_exclude`: `string` - Comma separated list of genres IDs to exclude
  - `order_by`: `enum` - The order of the results. Possible values: `mal_id`, `title`, `start_date`, `end_date`, `episodes`, `score`, `scored_by`, `rank`, `popularity`, `members`, `favorites`.
  - `sort`: `enum` - The sort order. Possible values: `asc`, `desc`.
  - `letter`: `string` - The first letter of the anime title.
  - `producers`: `string` - Comma separated list of producer IDs.
  - `start_date`: `string` - The start date of the anime.
  - `end_date`: `string` - The end date of the anime.
- **Description**: Searches for anime titles.
- **Response Codes**:
  - `200 OK`: Success.
  - `500 Internal Server Error`: Failure.
- **Response Interface**: [`AnimeSearchResult`](#AnimeSearchResult)

### Get Anime via ID (MAL)

- **URL**: `/anime/:id`
- **Method**: `GET`
- **Auth Required**: No
- **Description**: Returns the anime title with the given MAL ID.
- **Response Codes**:
  - `200 OK`: Success.
  - `404 Not Found`: Anime not found.
  - `500 Internal Server Error`: Failure.
- **Response Interface**: [`SingleAnime`](#SingleAnime)

### Get Anime via ID (AniList)

- **URL**: `/anime/anilist/:id`
- **Method**: `GET`
- **Auth Required**: No
- **Description**: Returns the anime title with the given AniList ID.
- **Response Codes**:
  - `200 OK`: Success.
  - `404 Not Found`: Anime not found.
  - `500 Internal Server Error`: Failure.
- **Response Interface**: [`SingleAnime`](#SingleAnime)

> [!NOTE]
> The [Get Anime via ID (AniList)](#get-anime-via-id-anilist) endpoint uses a reverse lookup to find the MAL ID for the given AniList ID. The response will be the same as the [Get Anime via ID (MAL)](#get-anime-via-id-mal) endpoint for the found MAL ID.

### Get Anime Episodes

- **URL**: `/anime/:id/episodes`
- **Method**: `GET`
- **Auth Required**: No
- **Description**: Returns the episodes for the anime title with the given MAL ID.
- **Response Codes**:
  - `200 OK`: Success.
  - `404 Not Found`: Anime not found.
  - `500 Internal Server Error`: Failure.
- **Response Interface**: [`Array<AnimeEpisode>`](#AnimeEpisode)

### Get Single Anime Episode

- **URL**: `/anime/:id/episodes/:episode`
- **Method**: `GET`
- **Auth Required**: No
- **Description**: Returns the episode for the anime title with the given MAL ID and episode number.
- **Response Codes**:
  - `200 OK`: Success.
  - `404 Not Found`: Anime or episode not found.
  - `500 Internal Server Error`: Failure.
- **Response Interface**: `{ ...`[`AnimeEpisode`](#AnimeEpisode)`, "streamingLinks": Array<`[`EpisodeStreamLinks`](#EpisodeStreamLinks)`> }`

## Interfaces

### HealthStatus

```typescript
interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  memory: {
    used: number;
    total: number;
    free: number;
    usage: number;
  };
  database: {
    status: 'connected' | 'disconnected';
    lastChecked: string;
  };
  tasks: Record<
    string,
    {
      registered: boolean;
      running: boolean;
      lastRun?: Date;
      nextRun?: Date;
    }
  >;
}
```

### AnimeSearchResult

```typescript
interface AnimeSearchResult {
  results: Array<EmbeddedAnime>;
  meta: {
    count: number;
    total: number;
    perPage: number;
    currentPage: number;
    lastPage: number;
    hasNextPage: boolean;
  };
}
```

### EmbeddedAnime

```typescript
interface EmbeddedAnime {
  id: number;
  titles: {
    english: string;
    japanese: string;
    romaji: string;
  };
  type: string;
  status: string;
  airing: boolean;
  aired: {
    from: string;
    to: string;
  };
  ranks: {
    scores: {
      average: number;
      users: number;
    };
    ranked: number;
    popularity: number;
    members: number;
    favorites: number;
  };
  season: string;
  year: number;
  current?: boolean;
}
```

### SingleAnime

```typescript
interface SingleAnime {
  id: number;
  titles: {
    english: string;
    japanese: string;
    romaji: string;
  };
  synopsis: string;
  type: string;
  source: string;
  episodeCount: number;
  status: string;
  airing: boolean;
  startDate: string;
  endDate: string;
  duration: string;
  ageRating: string;
  ranks: {
    scores: {
      average: number;
      users: number;
    };
    ranked: number;
    popularity: number;
    members: number;
    favorites: number;
  };
  background: string;
  season: string;
  year: number;
  broadcast: {
    day: string;
    time: string;
    timezone: string;
    string: string;
  };
  producers: Array<{
    id: number;
    name: string;
  }>;
  licensors: Array<{
    id: number;
    name: string;
  }>;
  studios: Array<{
    id: number;
    name: string;
  }>;
  genres: Array<{
    id: number;
    name: string;
  }>;
  posters: {
    small?: string;
    medium: string;
    large: string;
    original: string;
  };
  coverImages: {
    small?: string;
    large: string;
    original: string;
  };
  trailer: string;
  seasons: EmbeddedAnime[];
  episodes: {
    counts: {
      sub: number;
      dub: number;
    };
    episodes: Array<AnimeEpisode>;
  };
  characters: Array<{
    name: string;
    role: string;
    image: string;
    voiceActors: Array<{
      name: string;
      image: string;
      language: string;
    }>;
  }>;
}
```

### AnimeEpisode

```typescript
interface AnimeEpisode {
  id: number;
  titles: {
    english: string;
    japanese: string;
    romaji: string;
  };
  aired: string;
  score: number | null;
  duration: number | string | null;
  synopsis: {
    english: string;
    japanese: string;
  } | null;
  filler: boolean;
  recap: boolean;
  forumUrl: string;
  seasonNumber?: number;
  number?: number;
  image?: string;
}
```

### EpisodeStreamLinks

```typescript
interface EpisodeStreamLinks {
  sub: {
    intro: {
      start: number;
      end: number;
    };
    outro: {
      start: number;
      end: number;
    };
    sources: {
      url: string;
      server: string;
    }[];
    captions: {
      url: string;
      lang: string;
    }[];
    thumbnails?: string;
  };
  dub: {
    intro: {
      start: number;
      end: number;
    };
    outro: {
      start: number;
      end: number;
    };
    sources: {
      url: string;
      server: string;
    }[];
    captions: {
      url: string;
      lang: string;
    }[];
    thumbnails?: string;
  };
}
```
