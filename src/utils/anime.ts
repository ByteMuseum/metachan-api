import axios from 'axios';
import { FribbMapping } from '../entities/FribbMapping';
import Logger from './logger';
import { TVDBClient, TVDBEpisode } from './tvdb';
import { fribbMappingRepository } from '../repositories/FribbMappingRepository';
import { getEpisodes } from './stream';
import { animeCacheRepository } from '../repositories/AnimeCacheRepository';

const tvdbClient = new TVDBClient({
  apiKey: process.env.TVDB_API_KEY || '',
});

interface MALAnime {
  data: {
    mal_id: number;
    url: string;
    images: {
      jpg: {
        image_url: string;
        small_image_url: string;
        large_image_url: string;
      };
      webp: {
        image_url: string;
        small_image_url: string;
        large_image_url: string;
      };
    };
    trailer: {
      youtube_id: string;
      url: string;
      embed_url: string;
    };
    approved: boolean;
    titles: Array<{
      type: string;
      title: string;
    }>;
    title: string;
    title_english: string;
    title_japanese: string;
    title_synonyms: string[];
    type: 'TV' | string;
    source: string;
    episodes: number;
    status: 'Finished Airing' | string;
    airing: boolean;
    aired: {
      from: string;
      to: string;
      prop: {
        from: {
          day: number;
          month: number;
          year: number;
        };
        to: {
          day: number;
          month: number;
          year: number;
        };
        string: string;
      };
    };
    duration: string;
    rating: 'G - All Ages' | string;
    score: number;
    scored_by: number;
    rank: number;
    popularity: number;
    members: number;
    favorites: number;
    synopsis: string;
    background: string;
    season: 'summer' | 'winter' | 'spring' | 'fall';
    year: number;
    broadcast: {
      day: string;
      time: string;
      timezone: string;
      string: string;
    };
    producers: Array<{
      mal_id: number;
      type: string;
      name: string;
      url: string;
    }>;
    licensors: Array<{
      mal_id: number;
      type: string;
      name: string;
      url: string;
    }>;
    studios: Array<{
      mal_id: number;
      type: string;
      name: string;
      url: string;
    }>;
    genres: Array<{
      mal_id: number;
      type: string;
      name: string;
      url: string;
    }>;
    explicit_genres: Array<{
      mal_id: number;
      type: string;
      name: string;
      url: string;
    }>;
    themes: Array<{
      mal_id: number;
      type: string;
      name: string;
      url: string;
    }>;
    demographics: Array<{
      mal_id: number;
      type: string;
      name: string;
      url: string;
    }>;
    relations: Array<{
      relation: string;
      entry: Array<{
        mal_id: number;
        type: string;
        name: string;
        url: string;
      }>;
    }>;
    theme: {
      openings: string[];
      endings: string[];
    };
    external: Array<{
      name: string;
      url: string;
    }>;
    streaming: Array<{
      name: string;
      url: string;
    }>;
  };
}

interface KitsuAnime {
  data: Array<{
    id: string;
    type: string;
    links: {
      self: string;
    };
    attributes: {
      createdAt: string;
      updatedAt: string;
      slug: string;
      synopsis: string;
      description: string;
      coverImageTopOffset: number;
      titles: {
        en: string;
        en_jp: string;
        ja_jp: string;
      };
      canonicalTitle: string;
      abbreviatedTitles: string[];
      averageRating: string;
      ratingFrequencies: {
        [key: string]: string;
      };
      userCount: number;
      favoritesCount: number;
      startDate: string;
      endDate: string | null;
      nextRelease: string | null;
      popularityRank: number;
      ratingRank: number;
      ageRating: string;
      ageRatingGuide: string;
      subtype: string;
      status: string;
      tba: string | null;
      posterImage: {
        tiny: string;
        large: string;
        small?: string;
        medium: string;
        original: string;
        meta: {
          dimensions: {
            [key: string]: {
              width: number;
              height: number;
            };
          };
        };
      };
      coverImage: {
        tiny: string;
        large: string;
        small?: string;
        original: string;
        meta: {
          dimensions: {
            [key: string]: {
              width: number;
              height: number;
            };
          };
        };
      };
      episodeCount: number | null;
      episodeLength: number;
      totalLength: number;
      youtubeVideoId: string;
      showType: string;
      nsfw: boolean;
    };
    relationships: {
      [key: string]: {
        links: {
          self: string;
          related: string;
        };
      };
    };
  }>;
  meta: {
    count: number;
  };
  links: {
    first: string;
    last: string;
  };
}

interface MALCharacter {
  data: Array<{
    character: {
      mal_id: number;
      url: string;
      images: {
        jpg: {
          image_url: string;
          small_image_url: string;
        };
        webp: {
          image_url: string;
          small_image_url: string;
        };
      };
      name: string;
    };
    role: string;
    voice_actors: Array<{
      person: {
        mal_id: number;
        url: string;
        images: {
          jpg: {
            image_url: string;
          };
        };
        name: string;
      };
      language: string;
    }>;
  }>;
}

interface MALAnimeEpisodes {
  data: Array<{
    mal_id: number;
    url: string;
    title: string;
    title_japanese: string;
    title_romanji: string;
    aired: string;
    score: number | null;
    filler: boolean;
    recap: boolean;
    forum_url: string;
  }>;
  pagination: {
    last_visible_page: number;
    has_next_page: boolean;
  };
}

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

export interface SingleAnime {
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

export interface SearchQueryParams {
  q: string;
  page?: number;
  limit?: number;
  type?: 'tv' | 'movie' | 'ova' | 'special' | 'ona' | 'music' | 'cm' | 'pv' | 'tv_special';
  score?: number;
  min_score?: number;
  max_score?: number;
  status?: 'airing' | 'completed' | 'upcoming';
  rating?: 'g' | 'pg' | 'pg13' | 'r17' | 'r' | 'rx';
  sfw?: boolean;
  genres?: string;
  genres_exclude?: string;
  order_by?:
    | 'mal_id'
    | 'title'
    | 'start_date'
    | 'end_date'
    | 'episodes'
    | 'score'
    | 'scored_by'
    | 'rank'
    | 'popularity'
    | 'members'
    | 'favorites';
  sort?: 'asc' | 'desc';
  letter?: string;
  producers?: string;
  start_date?: string;
  end_date?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithRetry = async <T>(url: string, maxRetries = 10, initialDelay = 350): Promise<T> => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      Logger.info(`Fetching ${url} (attempt ${attempt + 1}/${maxRetries})`, {
        timestamp: true,
        prefix: 'Anime',
      });
      const response = await axios.get<T>(url);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 429 && attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        Logger.warn(`Rate limited, retrying in ${delay}ms`, { timestamp: true, prefix: 'Anime' });
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
};

const formatEpisode = (episode: MALAnimeEpisodes['data'][0]): AnimeEpisode => ({
  id: episode.mal_id,
  titles: {
    english: episode.title,
    japanese: episode.title_japanese,
    romaji: episode.title_romanji,
  },
  aired: episode.aired,
  score: episode.score,
  duration: null,
  synopsis: null,
  filler: episode.filler,
  recap: episode.recap,
  forumUrl: episode.forum_url,
  seasonNumber: undefined,
  number: undefined,
  image: undefined,
});

const getAnimeEpisodes = async (malId: number, page = 1, limit = 100): Promise<AnimeEpisode[]> => {
  const episodes = await fetchWithRetry<MALAnimeEpisodes>(
    `https://api.jikan.moe/v4/anime/${malId}/episodes?page=${page}&limit=${limit}`,
  );

  if (!episodes.data) {
    return [];
  }

  const formattedEpisodes = episodes.data.map(formatEpisode);

  if (episodes.pagination.has_next_page) {
    const nextPage = await getAnimeEpisodes(malId, page + 1, limit);
    return [...formattedEpisodes, ...nextPage];
  }

  return formattedEpisodes;
};

const getBasicMALInfo = async (malId: number): Promise<EmbeddedAnime | null> => {
  const anime = await fetchWithRetry<MALAnime>(`https://api.jikan.moe/v4/anime/${malId}`);

  if (!anime.data) return null;

  return {
    id: anime.data.mal_id,
    titles: {
      english: anime.data.title_english,
      japanese: anime.data.title_japanese,
      romaji: anime.data.title,
    },
    type: anime.data.type,
    status: anime.data.status,
    airing: anime.data.airing,
    aired: {
      from: anime.data.aired.from,
      to: anime.data.aired.to,
    },
    ranks: {
      scores: {
        average: anime.data.score,
        users: anime.data.scored_by,
      },
      ranked: anime.data.rank,
      popularity: anime.data.popularity,
      members: anime.data.members,
      favorites: anime.data.favorites,
    },
    season: anime.data.season,
    year: anime.data.year,
  };
};

const mergeTVDBEpisodes = (
  malEpisodes: AnimeEpisode[],
  tvdbEpisodes: TVDBEpisode[],
): AnimeEpisode[] => {
  // Filter only main season episodes (not specials)
  const mainEpisodes = tvdbEpisodes
    .filter((ep) => ep.seasonNumber === 1 && ep.number && ep.number <= malEpisodes.length)
    .sort((a, b) => a.number - b.number);

  return malEpisodes.map((malEpisode, index) => {
    const tvdbEpisode = mainEpisodes.find((ep) => ep.number === index + 1);

    if (!tvdbEpisode) {
      return malEpisode;
    }

    // Get English translation
    const englishOverview =
      tvdbEpisode.overviewTranslations?.find((t) => t.language === 'eng')?.overview || '';

    // Get Japanese translation
    const japaneseOverview =
      tvdbEpisode.overviewTranslations?.find((t) => t.language === 'jpn')?.overview ||
      tvdbEpisode.overview ||
      '';

    return {
      ...malEpisode,
      duration: tvdbEpisode.runtime ? `${tvdbEpisode.runtime} mins` : 'N/A',
      synopsis: {
        english: englishOverview,
        japanese: japaneseOverview,
      },
      image: tvdbEpisode.image,
      seasonNumber: tvdbEpisode.seasonNumber,
      number: tvdbEpisode.number,
    };
  });
};

export const getBasicAnime = async (fribbMapping: FribbMapping): Promise<EmbeddedAnime | null> => {
  const malAnime = await getBasicMALInfo(fribbMapping.mal_id);
  if (!malAnime) {
    return null;
  }

  return malAnime;
};

export const getFullAnime = async (fribbMapping: FribbMapping): Promise<SingleAnime | null> => {
  const cached = await animeCacheRepository.getCachedAnime(fribbMapping.mal_id);
  if (cached) {
    return cached;
  }

  const malAnime = await axios.get<MALAnime>(
    `https://api.jikan.moe/v4/anime/${fribbMapping.mal_id}/full`,
  );

  if (!malAnime.data.data) {
    return null;
  }

  const kitsuAnime = await axios.get<KitsuAnime>(
    `https://kitsu.io/api/edge/anime?filter[id]=${fribbMapping.kitsu_id}`,
  );
  if (kitsuAnime.data.data.length === 0) {
    return null;
  }

  const animeCharacters = await axios.get<MALCharacter>(
    `https://api.jikan.moe/v4/anime/${fribbMapping.mal_id}/characters`,
  );
  const characters = animeCharacters.data.data.map((character) => ({
    name: character.character.name,
    role: character.role,
    image: character.character.images.jpg.image_url,
    voiceActors: character.voice_actors.map((voiceActor) => ({
      name: voiceActor.person.name,
      image: voiceActor.person.images.jpg.image_url,
      language: voiceActor.language,
    })),
  }));

  const animeEpisodes = await getAnimeEpisodes(fribbMapping.mal_id);

  let tvdbInfo = null;
  let episodes = animeEpisodes;

  if (fribbMapping.thetvdb_id) {
    tvdbInfo = await tvdbClient.getAnimeById(fribbMapping.thetvdb_id);
    try {
      const tvdbEpisodesResponse = await tvdbClient.getAnimeEpisodes(fribbMapping.thetvdb_id);
      if (tvdbEpisodesResponse?.data?.episodes) {
        episodes = mergeTVDBEpisodes(animeEpisodes, tvdbEpisodesResponse.data.episodes);
      }
    } catch (error) {
      Logger.error(
        `Failed to fetch TVDB episodes: ${error instanceof Error ? error.message : String(error)}`,
        {
          prefix: 'Anime',
          timestamp: true,
        },
      );
    }
  }

  const title =
    kitsuAnime.data.data[0].attributes.canonicalTitle ||
    kitsuAnime.data.data[0].attributes.titles.en ||
    kitsuAnime.data.data[0].attributes.titles.ja_jp;
  const streamingEpisodes = await getEpisodes(title);

  if (
    episodes.length !== streamingEpisodes.sub.length ||
    streamingEpisodes.sub.length > episodes.length
  ) {
    Logger.info(`Filling missing episodes for ${title}`, { prefix: 'Anime Episodes' });
    const remainingEpisodes = streamingEpisodes.sub.length - episodes.length;
    Logger.debug(`Missing episodes: ${remainingEpisodes}`, { prefix: 'Anime Episodes' });
    for (let i = 0; i < remainingEpisodes; i++) {
      episodes.push({
        id: episodes.length + i + 1,
        titles: {
          romaji: 'Episode ' + (i + episodes.length + 1),
          english: 'Episode ' + (i + episodes.length + 1),
          japanese: 'エピソード ' + (i + episodes.length + 1),
        },
        aired: 'Unknown',
        score: 0,
        duration: episodes.length > 0 ? `${episodes[0].duration}` : 'Unknown',
        synopsis: {
          english: 'No synopsis available',
          japanese: 'シノプシスはありません',
        },
        filler: false,
        recap: false,
        forumUrl: '',
        seasonNumber: 1,
        number: i + episodes.length + 1,
        image:
          kitsuAnime.data.data[0].attributes.coverImage?.original ??
          kitsuAnime.data.data[0].attributes.posterImage?.original ??
          malAnime.data.data.images.jpg.image_url ??
          '',
      });
    }
  }

  if (
    malAnime.data.data.status === 'Finished Airing' &&
    malAnime.data.data.episodes &&
    episodes.length > malAnime.data.data.episodes
  ) {
    episodes = episodes.slice(0, malAnime.data.data.episodes);
    streamingEpisodes.sub = streamingEpisodes.sub.slice(0, malAnime.data.data.episodes);
    streamingEpisodes.dub = streamingEpisodes.dub.slice(0, malAnime.data.data.episodes);
  }

  let seasons = [];
  if (tvdbInfo?.data?.seasons) {
    const seasonMappings = await fribbMappingRepository.findByTVDBId(fribbMapping.thetvdb_id);

    for (const mapping of seasonMappings) {
      const seasonInfo = await getBasicMALInfo(mapping.mal_id);
      if (seasonInfo) {
        seasons.push({
          ...seasonInfo,
          current: mapping.mal_id === fribbMapping.mal_id,
        });
      }
    }
  }

  const animeResponse: SingleAnime = {
    id: malAnime.data.data.mal_id,
    titles: {
      english: kitsuAnime.data.data[0].attributes.titles.en,
      japanese: kitsuAnime.data.data[0].attributes.titles.ja_jp,
      romaji: kitsuAnime.data.data[0].attributes.canonicalTitle,
    },
    synopsis: malAnime.data.data.synopsis
      .replace('\n\n[Written by MAL Rewrite]', '')
      .replace('\n[Written by MAL Rewrite]', ''),
    type: malAnime.data.data.type,
    source: malAnime.data.data.source,
    episodeCount: malAnime.data.data.episodes,
    status: malAnime.data.data.status,
    airing: malAnime.data.data.airing,
    startDate: malAnime.data.data.aired.from,
    endDate: malAnime.data.data.aired.to,
    duration: malAnime.data.data.duration,
    ageRating: malAnime.data.data.rating,
    ranks: {
      scores: {
        average: malAnime.data.data.score,
        users: malAnime.data.data.scored_by,
      },
      ranked: malAnime.data.data.rank,
      popularity: malAnime.data.data.popularity,
      members: malAnime.data.data.members,
      favorites: malAnime.data.data.favorites,
    },
    background: malAnime.data.data.background,
    season: malAnime.data.data.season,
    year: malAnime.data.data.year,
    broadcast: malAnime.data.data.broadcast,
    producers: malAnime.data.data.producers.map((producer) => ({
      id: producer.mal_id,
      name: producer.name,
    })),
    licensors: malAnime.data.data.licensors.map((licensor) => ({
      id: licensor.mal_id,
      name: licensor.name,
    })),
    studios: malAnime.data.data.studios.map((studio) => ({
      id: studio.mal_id,
      name: studio.name,
    })),
    genres: [
      ...malAnime.data.data.genres.map((genre) => ({
        id: genre.mal_id,
        name: genre.name,
      })),
      ...malAnime.data.data.explicit_genres.map((genre) => ({
        id: genre.mal_id,
        name: genre.name,
      })),
    ],
    posters: {
      small:
        kitsuAnime.data.data[0].attributes.posterImage.small ??
        malAnime.data.data.images.jpg.small_image_url,
      medium:
        kitsuAnime.data.data[0].attributes.posterImage.medium ??
        malAnime.data.data.images.jpg.image_url,
      large:
        kitsuAnime.data.data[0].attributes.posterImage.large ??
        malAnime.data.data.images.jpg.large_image_url,
      original:
        kitsuAnime.data.data[0].attributes.posterImage.original ??
        malAnime.data.data.images.jpg.image_url,
    },
    coverImages: {
      small: kitsuAnime.data.data[0].attributes.coverImage?.small,
      large: kitsuAnime.data.data[0].attributes.coverImage?.large,
      original: kitsuAnime.data.data[0].attributes.coverImage?.original,
    },
    trailer: malAnime.data.data.trailer.url,
    seasons: seasons.sort((a, b) => {
      const typeOrder: { [key: string]: number } = { TV: 1, Movie: 2, OVA: 3, Special: 4 };
      const getTypeValue = (type: string) => typeOrder[type] || 5;

      if (getTypeValue(a.type) !== getTypeValue(b.type)) {
        return getTypeValue(a.type) - getTypeValue(b.type);
      }

      const aDate = new Date(a.aired.from);
      const bDate = new Date(b.aired.from);
      return aDate.getTime() - bDate.getTime();
    }),
    episodes: {
      counts: {
        sub: streamingEpisodes.sub.length,
        dub: streamingEpisodes.dub.length,
      },
      episodes,
    },
    characters,
  };

  const cacheExpiryDays = animeResponse.status === 'Finished Airing' ? 30 : 1;
  await animeCacheRepository.cacheAnime(fribbMapping.mal_id, animeResponse, cacheExpiryDays);

  return animeResponse;
};

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

interface JikanSearchResponse {
  data: Array<MALAnime['data']>;
  pagination: {
    last_visible_page: number;
    has_next_page: boolean;
    current_page: number;
    items: {
      count: number;
      total: number;
      per_page: number;
    };
  };
}

const buildSearchQuery = (params: SearchQueryParams): string => {
  const queryParams = new URLSearchParams();

  // Add all non-empty parameters to the query string
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      queryParams.append(key, value.toString());
    }
  });

  return queryParams.toString();
};

export const searchAnimeQuery = async (params: SearchQueryParams): Promise<AnimeSearchResult> => {
  try {
    const queryString = buildSearchQuery(params);
    const response = await axios.get<JikanSearchResponse>(
      `https://api.jikan.moe/v4/anime?${queryString}`,
    );
    const jikanSearchResponse = response.data;

    // Use a Map to deduplicate by id while mapping
    const uniqueResults = new Map(
      jikanSearchResponse.data.map((anime) => [
        anime.mal_id,
        {
          id: anime.mal_id,
          titles: {
            english: anime.title_english,
            japanese: anime.title_japanese,
            romaji: anime.title,
          },
          type: anime.type,
          status: anime.status,
          airing: anime.airing,
          aired: {
            from: anime.aired.from,
            to: anime.aired.to,
          },
          ranks: {
            scores: {
              average: anime.score,
              users: anime.scored_by,
            },
            ranked: anime.rank,
            popularity: anime.popularity,
            members: anime.members,
            favorites: anime.favorites,
          },
          season: anime.season,
          year: anime.year,
        },
      ]),
    );

    const results = Array.from(uniqueResults.values());
    Logger.info(`Found ${results.length} unique results for query: ${params.q}`, {
      prefix: 'Anime Search',
      timestamp: true,
    });

    return {
      results,
      meta: {
        count: results.length,
        total: results.length,
        perPage: jikanSearchResponse.pagination.items.per_page,
        currentPage: jikanSearchResponse.pagination.current_page,
        lastPage: jikanSearchResponse.pagination.last_visible_page,
        hasNextPage: jikanSearchResponse.pagination.has_next_page,
      },
    };
  } catch (error) {
    Logger.error(error instanceof Error ? error : `Search query failed for: ${params.q}`, {
      prefix: 'Anime Search',
      timestamp: true,
    });
    throw error;
  }
};
