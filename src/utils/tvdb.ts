import axios, { AxiosError } from 'axios';
import Logger from './logger';

interface TVDBConfig {
  apiKey: string;
  pin?: string;
}

interface TVDBArtwork {
  id: number;
  image: string;
  thumbnail: string;
  language: string | null;
  type: number;
  score: number;
  width: number;
  height: number;
  includesText: boolean;
  thumbnailWidth: number;
  thumbnailHeight: number;
  updatedAt: number;
  status: {
    id: number;
    name: string | null;
  };
  tagOptions: null;
  seasonId?: number;
}

interface TVDBCompany {
  id: number;
  name: string;
  slug: string;
  nameTranslations: string[];
  overviewTranslations: string[];
  aliases: Array<{
    language: string;
    name: string;
  }>;
  country: string;
  primaryCompanyType: number;
  activeDate: string | null;
  inactiveDate: string | null;
  companyType: {
    companyTypeId: number;
    companyTypeName: string;
  };
  parentCompany: {
    id: number | null;
    name: string | null;
    relation: {
      id: null;
      typeName: null;
    };
  };
  tagOptions: null;
}

interface TVDBCharacter {
  id: number;
  name: string;
  peopleId: number;
  seriesId: number;
  series: null;
  movie: null;
  movieId: null;
  episodeId: null;
  type: number;
  image: string;
  sort: number;
  isFeatured: boolean;
  url: string;
  nameTranslations: null;
  overviewTranslations: null;
  aliases: null;
  peopleType: string;
  personName: string;
  tagOptions: null;
  personImgURL: string;
}

interface TVDBSeason {
  id: number;
  seriesId: number;
  type: {
    id: number;
    name: string;
    type: string;
    alternateName: string | null;
  };
  number: number;
  nameTranslations: string[];
  overviewTranslations: string[];
  image?: string;
  imageType?: number;
  companies: {
    studio: null;
    network: null;
    production: null;
    distributor: null;
    special_effects: null;
  };
  lastUpdated: string;
  name?: string;
}

interface TVDBResponse {
  status: 'success' | 'error';
  data: {
    id: number;
    name: string;
    slug: string;
    image: string;
    nameTranslations: string[];
    overviewTranslations: string[];
    aliases: Array<{
      language: string;
      name: string;
    }>;
    firstAired: string;
    lastAired: string;
    nextAired: string;
    score: number;
    status: {
      id: number;
      name: string;
      recordType: string;
      keepUpdated: boolean;
    };
    originalCountry: string;
    originalLanguage: string;
    defaultSeasonType: number;
    isOrderRandomized: boolean;
    lastUpdated: string;
    averageRuntime: number;
    episodes: null;
    overview: string;
    year: string;
    artworks: TVDBArtwork[];
    companies: TVDBCompany[];
    originalNetwork: TVDBCompany;
    latestNetwork: TVDBCompany;
    genres: Array<{
      id: number;
      name: string;
      slug: string;
    }>;
    contentRatings: Array<{
      id: number;
      name: string;
      country: string;
      description: string;
      contentType: string;
      order: number;
      fullname: string | null;
    }>;
    characters: TVDBCharacter[];
    seasons: TVDBSeason[];
    seasonTypes: Array<{
      id: number;
      name: string;
      type: string;
      alternateName: string | null;
    }>;
  };
}

export class TVDBClient {
  private token: string | null = null;
  private tokenExpiry: number = 0;
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api4.thetvdb.com/v4';

  constructor(config: TVDBConfig) {
    this.apiKey = config.apiKey;
  }

  private async authenticate(): Promise<void> {
    try {
      const response = await axios.post(`${this.baseUrl}/login`, {
        apiKey: this.apiKey,
      });

      if (!response.data?.data?.token) {
        throw new Error('Invalid authentication response');
      }

      const { token, expiresAt } = response.data.data;
      this.token = token;
      this.tokenExpiry = new Date(expiresAt).getTime();

      Logger.info('TVDB Authentication successful', { timestamp: true, prefix: 'TVDB' });
    } catch (error) {
      Logger.error('TVDB Authentication failed', { timestamp: true, prefix: 'TVDB' });
      throw error;
    }
  }

  private async ensureAuthenticated(): Promise<void> {
    if (this.token && this.tokenExpiry > Date.now()) {
      return;
    }
    await this.authenticate();
  }

  private async request<T, D = Record<string, unknown>>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    data?: D,
  ): Promise<T> {
    await this.ensureAuthenticated();

    try {
      const response = await axios({
        method,
        url: `${this.baseUrl}${endpoint}`,
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        data,
      });
      return response.data;
    } catch (error) {
      if (error instanceof AxiosError && error.response?.status === 401) {
        Logger.warn('Token expired, reauthenticating', { timestamp: true, prefix: 'TVDB' });
        await this.authenticate();
        return this.request(endpoint, method, data);
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      Logger.error(`Request failed: ${message}`, { timestamp: true, prefix: 'TVDB' });
      throw error;
    }
  }

  async searchAnime(query: string) {
    Logger.debug(`Searching for anime: ${query}`, { timestamp: true, prefix: 'TVDB' });
    return this.request<TVDBResponse>('/search', 'POST', {
      query,
      type: 'series',
      filter: {
        type: 'anime',
      },
    });
  }

  async getAnimeById(id: number) {
    Logger.debug(`Fetching anime details: ${id}`, { timestamp: true, prefix: 'TVDB' });
    return this.request<TVDBResponse>(`/series/${id}/extended`);
  }

  async getAnimeEpisodes(id: number, season?: number) {
    Logger.debug(`Fetching episodes for anime: ${id}, season: ${season || 'all'}`, {
      timestamp: true,
      prefix: 'TVDB',
    });
    const endpoint = season
      ? `/series/${id}/episodes/official/${season}`
      : `/series/${id}/episodes/official`;
    return this.request<TVDBResponse>(endpoint);
  }
}

export default TVDBClient;
