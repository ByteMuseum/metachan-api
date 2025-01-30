import { BaseRepository } from './BaseRepository';
import { FribbMapping } from '../entities/FribbMapping';
import Logger from '../utils/logger';

export class FribbMappingRepository extends BaseRepository<FribbMapping> {
  constructor() {
    super(FribbMapping);
  }

  async findByMalId(malId: number): Promise<FribbMapping | undefined> {
    try {
      return (
        (await this.repository.findOne({
          where: {
            mal_id: malId,
          },
        })) ?? undefined
      );
    } catch (error) {
      Logger.error('Error finding fribb mapping by MAL ID', {
        timestamp: true,
        prefix: 'Database',
      });
      throw error;
    }
  }

  async findByTVDBId(tvdbId: number): Promise<FribbMapping[]> {
    try {
      return await this.repository.find({
        where: {
          thetvdb_id: tvdbId,
        },
      });
    } catch (error) {
      Logger.error('Error finding fribb mapping by TVDB ID', {
        timestamp: true,
        prefix: 'Database',
      });
      throw error;
    }
  }

  async findByAnilistId(anilistId: number): Promise<FribbMapping | undefined> {
    try {
      return (
        (await this.repository.findOne({
          where: {
            anilist_id: anilistId,
          },
        })) ?? undefined
      );
    } catch (error) {
      Logger.error('Error finding fribb mapping by Anilist ID', {
        timestamp: true,
        prefix: 'Database',
      });
      throw error;
    }
  }
}

export const fribbMappingRepository = new FribbMappingRepository();
