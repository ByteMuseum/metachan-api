import axios from 'axios';
import { FribbMapping } from '../entities/FribbMapping';
import Logger from './logger';
import { TVDBClient } from './tvdb';
import { fribbMappingRepository } from '../repositories/FribbMappingRepository';

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
        small: string;
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
        small: string;
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

const getAnimeEpisodes = async (
  malId: number,
  page = 1,
  limit = 100,
): Promise<ReturnType<typeof formatEpisode>[]> => {
  const formatEpisode = (episode: MALAnimeEpisodes['data'][0]) => ({
    id: episode.mal_id,
    titles: {
      english: episode.title,
      japanese: episode.title_japanese,
      romaji: episode.title_romanji,
    },
    aired: episode.aired,
    score: episode.score,
    filler: episode.filler,
    recap: episode.recap,
    forumUrl: episode.forum_url,
  });

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

const getBasicMALInfo = async (malId: number) => {
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

export const getFullAnime = async (fribbMapping: FribbMapping) => {
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
  if (fribbMapping.thetvdb_id) {
    tvdbInfo = await tvdbClient.getAnimeById(fribbMapping.thetvdb_id);
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

  const animeResponse = {
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
      small: kitsuAnime.data.data[0].attributes.posterImage.small,
      medium: kitsuAnime.data.data[0].attributes.posterImage.medium,
      large: kitsuAnime.data.data[0].attributes.posterImage.large,
      original: kitsuAnime.data.data[0].attributes.posterImage.original,
    },
    coverImages: {
      small: kitsuAnime.data.data[0].attributes.coverImage.small,
      large: kitsuAnime.data.data[0].attributes.coverImage.large,
      original: kitsuAnime.data.data[0].attributes.coverImage.original,
    },
    trailer: malAnime.data.data.trailer.url,
    seasons: seasons.sort((a, b) => {
      // Type order: TV -> Movie -> OVA -> Special -> etc
      const typeOrder: { [key: string]: number } = { TV: 1, Movie: 2, OVA: 3, Special: 4 };
      const getTypeValue = (type: string) => typeOrder[type] || 5;

      // If different types, sort by type order
      if (getTypeValue(a.type) !== getTypeValue(b.type)) {
        return getTypeValue(a.type) - getTypeValue(b.type);
      }

      // If same type, sort by aired date
      const aDate = new Date(a.aired.from);
      const bDate = new Date(b.aired.from);
      return aDate.getTime() - bDate.getTime();
    }),
    episodes:
      animeEpisodes.length === 0
        ? {
            id: 1,
            titles: {
              english: kitsuAnime.data.data[0].attributes.titles.en,
              japanese: kitsuAnime.data.data[0].attributes.titles.ja_jp,
              romaji: kitsuAnime.data.data[0].attributes.canonicalTitle,
            },
            aired: malAnime.data.data.aired.from,
            score: malAnime.data.data.score,
            filler: false,
            recap: false,
            forumUrl: `https://api.jikan.moe/v4/anime/${fribbMapping.mal_id}/forum`,
          }
        : animeEpisodes,
    characters,
  };

  return animeResponse;
};
