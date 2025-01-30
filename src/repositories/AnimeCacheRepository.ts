import { BaseRepository } from './BaseRepository';
import { AnimeCache } from '../entities/AnimeCache';
import Logger from '../utils/logger';
import { SingleAnime } from '../utils/anime';
import { StreamLinks } from '../utils/stream';

export class AnimeCacheRepository extends BaseRepository<AnimeCache> {
  constructor() {
    super(AnimeCache);
  }

  async getCachedAnime(malId: number): Promise<SingleAnime | null> {
    try {
      const cache = await this.repository.findOne({
        where: { malId, type: 'anime' },
      });

      if (!cache || cache.expiresAt < new Date()) {
        return null;
      }

      return JSON.parse(cache.data) as SingleAnime;
    } catch (error) {
      Logger.error(`Error retrieving anime from cache: ${error}`, {
        timestamp: true,
        prefix: 'Anime Cache',
      });
      return null;
    }
  }

  async cacheAnime(malId: number, anime: SingleAnime, expiresInDays: number): Promise<void> {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      // Delete existing cache if any
      await this.repository.delete({ malId, type: 'anime' });

      // Create new cache entry
      await this.repository.save({
        malId,
        type: 'anime',
        data: JSON.stringify(anime),
        expiresAt,
      });

      Logger.info(`Cached anime ${malId} until ${expiresAt.toISOString()}`, {
        timestamp: true,
        prefix: 'Anime Cache',
      });
    } catch (error) {
      Logger.error(`Error caching anime: ${error}`, {
        timestamp: true,
        prefix: 'Anime Cache',
      });
    }
  }

  async getCachedStreamingLinks(malId: number, episodeNumber: number): Promise<StreamLinks | null> {
    try {
      const cache = await this.repository.findOne({
        where: { malId, episodeNumber, type: 'stream' },
      });

      if (!cache || cache.expiresAt < new Date()) {
        return null;
      }

      return JSON.parse(cache.data) as StreamLinks;
    } catch (error) {
      Logger.error(`Error retrieving streaming links from cache: ${error}`, {
        timestamp: true,
        prefix: 'Stream Cache',
      });
      return null;
    }
  }

  async cacheStreamingLinks(
    malId: number,
    episodeNumber: number,
    links: StreamLinks,
    expiresInDays: number = 7,
  ): Promise<void> {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      // Delete existing cache if any
      await this.repository.delete({ malId, episodeNumber, type: 'stream' });

      // Create new cache entry
      await this.repository.save({
        malId,
        episodeNumber,
        type: 'stream',
        data: JSON.stringify(links),
        expiresAt,
      });

      Logger.info(`Cached streaming links for anime ${malId} episode ${episodeNumber}`, {
        timestamp: true,
        prefix: 'Stream Cache',
      });
    } catch (error) {
      Logger.error(`Error caching streaming links: ${error}`, {
        timestamp: true,
        prefix: 'Stream Cache',
      });
    }
  }
}

export const animeCacheRepository = new AnimeCacheRepository();
