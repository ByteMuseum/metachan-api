import axios from 'axios';
import Logger from './logger';

interface TMDBConfig {
  apiKey: string;
  readAccessToken: string;
}

interface TMDBShowResult {
  id: number;
  name: string;
  first_air_date: string;
  origin_country: string[];
  adult: boolean;
}

interface TMDBEpisode {
  id: number;
  name: string;
  overview: string;
  still_path: string;
  air_date: string;
  episode_number: number;
  season_number: number;
}

interface TMDBSeasonDetails {
  episodes: TMDBEpisode[];
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

class TMDBMapper {
  private readonly baseUrl = 'https://api.themoviedb.org/3';
  private readonly imageUrl = 'https://image.tmdb.org/t/p/original';

  constructor(private config: TMDBConfig) {}

  private getHeaders() {
    return {
      Authorization: `Bearer ${this.config.readAccessToken}`,
      accept: 'application/json',
    };
  }

  private compareTwoStrings(str1: string, str2: string): number {
    const cleanStr1 = str1.replace(/\s+/g, '');
    const cleanStr2 = str2.replace(/\s+/g, '');

    if (cleanStr1 === cleanStr2) return 1;
    if (cleanStr1.length < 2 || cleanStr2.length < 2) return 0;

    const bigrams = new Map<string, number>();

    for (let i = 0; i < cleanStr1.length - 1; i++) {
      const bigram = cleanStr1.slice(i, i + 2);
      bigrams.set(bigram, (bigrams.get(bigram) || 0) + 1);
    }

    let intersections = 0;
    for (let i = 0; i < cleanStr2.length - 1; i++) {
      const bigram = cleanStr2.slice(i, i + 2);
      if (bigrams.has(bigram) && bigrams.get(bigram)! > 0) {
        bigrams.set(bigram, bigrams.get(bigram)! - 1);
        intersections++;
      }
    }

    return (2.0 * intersections) / (cleanStr1.length + cleanStr2.length - 2);
  }

  private romanToDecimal(roman: string): number {
    const values: Record<string, number> = {
      I: 1,
      V: 5,
      X: 10,
      L: 50,
      C: 100,
      D: 500,
      M: 1000,
    };

    let total = 0;
    let prevValue = 0;

    for (const char of roman.toUpperCase().split('').reverse()) {
      const currentValue = values[char];
      if (currentValue >= prevValue) {
        total += currentValue;
      } else {
        total -= currentValue;
      }
      prevValue = currentValue;
    }

    return total;
  }

  private parseTitleAndSeason(title: string): { showName: string; seasonInfo: string } {
    const mediaTypes = ['TV', 'TV_SHORT', 'OVA', 'ONA', 'MOVIE', 'SPECIAL', 'MUSIC'];
    const pattern = new RegExp(`\\s*(${mediaTypes.join('|')})\\s*$`, 'i');
    const cleanTitle = title.replace(pattern, '').trim();

    const seasonPattern =
      /^(.*?)(Season \d+|Cour \d+|Part \d+|Series \d+|Level \d+|(\bI{1,3}\b|\bIV\b|\bV\b|\bVI\b|\bVII\b|\bVIII\b|\bIX\b|\bX\b)( Part \d+)?|\bI{1,3}\b|\bIV\b|\bV\b|\bVI\b|\bVII\b|\bVIII\b|\bIX\b|\bX\b)$/i;
    const match = cleanTitle.match(seasonPattern);

    if (!match) {
      return { showName: cleanTitle, seasonInfo: '' };
    }

    const showName = match[1].trim();
    let seasonInfo = match[2].trim();

    const romanMatch = seasonInfo.match(
      /(\bI{1,3}\b|\bIV\b|\bV\b|\bVI\b|\bVII\b|\bVIII\b|\bIX\b|\bX\b)/i,
    );
    if (romanMatch) {
      seasonInfo = `Season ${this.romanToDecimal(romanMatch[1])}`;
    }

    return { showName, seasonInfo };
  }

  private async searchTVShowsByTitle(
    title: string,
    options: {
      alternativeTitle?: string;
      isAdult?: boolean;
      countryPriority?: string;
      maxYear?: number;
    } = {},
  ): Promise<TMDBShowResult[]> {
    try {
      let query = title.split(':')[0].trim();
      if (!query.includes(' ') && options.alternativeTitle) {
        query += ` ${options.alternativeTitle}`;
      }

      let results = await this.performSearch(query);

      if (!results.length) {
        results = await this.performSearch(title);
      }

      if (!results.length) {
        const pattern = /\s*\([A-Z_]+\)\s*$/i;
        if (pattern.test(title)) {
          const cleanTitle = title.replace(pattern, '').trim();
          results = await this.performSearch(cleanTitle);
        }
      }

      if (results.length) {
        if (options.isAdult !== undefined) {
          results = results.filter((r) => r.adult === options.isAdult);
        }

        if (options.countryPriority) {
          results.sort((a, b) => {
            const aHasPriority = a.origin_country.includes(options.countryPriority!);
            const bHasPriority = b.origin_country.includes(options.countryPriority!);
            return Number(bHasPriority) - Number(aHasPriority);
          });
        }

        if (options.maxYear) {
          results = results.filter((r) => {
            if (!r.first_air_date) return true;
            const year = parseInt(r.first_air_date.split('-')[0]);
            return !isNaN(year) && options.maxYear !== undefined && year <= options.maxYear;
          });
        }
      }

      return results;
    } catch (error) {
      Logger.error(
        `Error in searchTVShowsByTitle: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          prefix: 'TMDB',
          timestamp: true,
        },
      );
      return [];
    }
  }

  private async performSearch(query: string, retries = 3, delay = 1000): Promise<TMDBShowResult[]> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await axios.get(`${this.baseUrl}/search/tv`, {
          headers: this.getHeaders(),
          params: { query },
          timeout: 5000,
        });
        return response.data.results || [];
      } catch (error) {
        const isLastAttempt = attempt === retries - 1;
        if (isLastAttempt) {
          Logger.error(`Failed to search TMDB after ${retries} attempts for query: ${query}`, {
            prefix: 'TMDB',
            timestamp: true,
          });
          throw error;
        }

        Logger.warn(`TMDB search attempt ${attempt + 1} failed, retrying in ${delay}ms...`, {
          prefix: 'TMDB',
          timestamp: true,
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    return [];
  }

  private normalizeTitle(title: string): string {
    // Remove common suffixes and prefixes
    let normalized = title
      .replace(/^(TV\s+)?Animation\s+/i, '')
      .replace(/\s*:\s*Season\s+\d+$/i, '')
      .replace(/\s*Season\s+\d+$/i, '')
      .replace(/\s*Part\s+\d+$/i, '')
      .replace(/\s*Cour\s+\d+$/i, '')
      .replace(/\s*\([^)]+\)$/g, '');

    // Handle specific patterns like "Dr. Stone: Stone Wars" -> "Dr. Stone"
    const colonIndex = normalized.indexOf(':');
    if (colonIndex > 0) {
      const mainTitle = normalized.substring(0, colonIndex).trim();
      const subTitle = normalized.substring(colonIndex + 1).trim();

      // If the subtitle contains the main title or vice versa, use the shorter one
      if (
        mainTitle.toLowerCase().includes(subTitle.toLowerCase()) ||
        subTitle.toLowerCase().includes(mainTitle.toLowerCase())
      ) {
        normalized = mainTitle.length <= subTitle.length ? mainTitle : subTitle;
      } else {
        // Otherwise keep the main title
        normalized = mainTitle;
      }
    }

    return normalized.trim();
  }

  private async findCorrectSeason(
    shows: TMDBShowResult[],
    title: string,
    options: {
      seasonNumber?: number;
      airDate?: string;
      episodeCount?: number;
    },
  ): Promise<{ showId: number; seasonNumber: number } | null> {
    for (const show of shows) {
      try {
        const response = await axios.get(`${this.baseUrl}/tv/${show.id}`, {
          headers: this.getHeaders(),
          timeout: 5000,
        });

        const seasons = response.data.seasons || [];

        for (const season of seasons) {
          let matchScore = 0;
          const maxScore = 3;

          if (options.seasonNumber !== undefined && season.season_number === options.seasonNumber) {
            matchScore += 1;
          }

          if (options.airDate && season.air_date) {
            const seasonYear = new Date(season.air_date).getFullYear();
            const targetYear = new Date(options.airDate).getFullYear();
            if (seasonYear === targetYear) {
              matchScore += 1;
            }
          }

          if (options.episodeCount !== undefined && season.episode_count === options.episodeCount) {
            matchScore += 1;
          }

          if (matchScore >= Math.min(2, maxScore)) {
            Logger.info(
              `Found matching season for "${title}": Show ID ${show.id}, Season ${season.season_number}`,
              {
                prefix: 'TMDB',
                timestamp: true,
              },
            );
            return {
              showId: show.id,
              seasonNumber: season.season_number,
            };
          }
        }
      } catch (error) {
        Logger.warn(`Failed to get seasons for show ${show.id}. Error: ${error}`, {
          prefix: 'TMDB',
          timestamp: true,
        });
        continue;
      }
    }

    return null;
  }

  private async getTVSeasonDetails(
    showId: number,
    seasonNumber: number,
    retries = 3,
    delay = 1000,
  ): Promise<TMDBSeasonDetails | null> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await axios.get(`${this.baseUrl}/tv/${showId}/season/${seasonNumber}`, {
          headers: this.getHeaders(),
          timeout: 5000,
        });
        return response.data;
      } catch (error) {
        const isLastAttempt = attempt === retries - 1;
        if (isLastAttempt) {
          Logger.error(
            `Failed to get season details after ${retries} attempts for show ${showId}, season ${seasonNumber}`,
            {
              prefix: 'TMDB',
              timestamp: true,
            },
          );
          Logger.debug(error as string, { prefix: 'TMDB', timestamp: true });
          return null;
        }

        Logger.warn(`Season details attempt ${attempt + 1} failed, retrying in ${delay}ms...`, {
          prefix: 'TMDB',
          timestamp: true,
        });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    return null;
  }

  private getImageUrl(path: string | null): string | undefined {
    return path ? `${this.imageUrl}${path}` : undefined;
  }

  async enrichEpisodes(
    title: string,
    episodes: AnimeEpisode[],
    options: {
      alternativeTitle?: string;
      isAdult?: boolean;
      countryPriority?: string;
      maxYear?: number;
      seasonNumber?: number;
      airDate?: string;
      episodeCount?: number;
    } = {},
  ): Promise<AnimeEpisode[]> {
    const normalizedTitle = this.normalizeTitle(title);
    const normalizedAltTitle = options.alternativeTitle
      ? this.normalizeTitle(options.alternativeTitle)
      : undefined;

    Logger.info(
      `Searching TMDB with normalized title: "${normalizedTitle}"${normalizedAltTitle ? ` (alt: "${normalizedAltTitle}")` : ''}`,
      {
        prefix: 'TMDB',
        timestamp: true,
      },
    );

    try {
      const shows = await this.searchTVShowsByTitle(normalizedTitle, {
        alternativeTitle: normalizedAltTitle,
        isAdult: options.isAdult,
        countryPriority: options.countryPriority,
        maxYear: options.maxYear,
      });

      if (!shows.length) {
        Logger.warn(`No TMDB shows found for: ${normalizedTitle}`, {
          prefix: 'TMDB',
          timestamp: true,
        });
        return episodes;
      }

      const seasonInfo = await this.findCorrectSeason(shows, normalizedTitle, {
        seasonNumber: options.seasonNumber,
        airDate: options.airDate,
        episodeCount: options.episodeCount,
      });

      if (!seasonInfo) {
        Logger.warn(`Could not find matching season for: ${normalizedTitle}`, {
          prefix: 'TMDB',
          timestamp: true,
        });
        return episodes;
      }

      const seasonDetails = await this.getTVSeasonDetails(
        seasonInfo.showId,
        seasonInfo.seasonNumber,
      );

      if (!seasonDetails) {
        return episodes;
      }

      return episodes.map((episode, index) => {
        const tmdbEpisode = seasonDetails.episodes[index];
        if (!tmdbEpisode) return episode;

        return {
          ...episode,
          synopsis: {
            english: tmdbEpisode.overview || episode.synopsis?.english || 'No synopsis available',
            japanese: episode.synopsis?.japanese || 'シノプシスはありません',
          },
          image: this.getImageUrl(tmdbEpisode.still_path) || episode.image,
          seasonNumber: tmdbEpisode.season_number,
          number: tmdbEpisode.episode_number,
        };
      });
    } catch (error) {
      Logger.error(
        `Error enriching episodes: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          prefix: 'TMDB',
          timestamp: true,
        },
      );
      return episodes;
    }
  }
}

export const createTMDBMapper = (config: TMDBConfig) => new TMDBMapper(config);
