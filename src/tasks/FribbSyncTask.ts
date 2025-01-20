import axios from 'axios';
import { Repository } from 'typeorm';
import { FribbMapping } from '../entities/FribbMapping';
import AppDataSource from '../database/data-source';
import Logger from '../utils/logger';

export interface FribbList {
    livechart_id: number;
    thetvdb_id: number;
    "anime-planet_id": string;
    imdb_id: string;
    anisearch_id: number;
    themoviedb_id: number;
    anidb_id: number;
    kitsu_id: number;
    mal_id: number;
    type: string;
    "notify.moe_id": string;
    anilist_id: number;
}

export class FribbSyncTask {
    private repository: Repository<FribbMapping>;
    private readonly FRIBB_URL = "https://raw.githubusercontent.com/Fribb/anime-lists/master/anime-list-full.json";

    constructor() {
        this.repository = AppDataSource.getRepository(FribbMapping);
    }

    async execute(): Promise<void> {
        try {
            Logger.info('Starting Fribb sync', { timestamp: true, prefix: 'FribbSync' });

            // Fetch the data
            const response = await axios.get<FribbList[]>(this.FRIBB_URL);
            const mappings = response.data;

            // Process in batches
            const batchSize = 100;
            for (let i = 0; i < mappings.length; i += batchSize) {
                const batch = mappings.slice(i, i + batchSize);
                await this.processBatch(batch);

                Logger.info(`Processed ${i + batch.length}/${mappings.length} mappings`, {
                    timestamp: true,
                    prefix: 'FribbSync'
                });
            }

            Logger.success('Fribb sync completed', { timestamp: true, prefix: 'FribbSync' });
        } catch (error) {
            Logger.error(`Fribb sync failed: ${error}`, { timestamp: true, prefix: 'FribbSync' });
            throw error;
        }
    }

    private async processBatch(mappings: FribbList[]): Promise<void> {
        for (const mapping of mappings) {
            try {
                // Create composite key for MAL and AniList IDs if both exist
                const mal_anilist_composite = mapping.mal_id && mapping.anilist_id
                    ? `${mapping.mal_id}-${mapping.anilist_id}`
                    : null;

                // Try to find existing mapping by livechart_id or mal_anilist_composite
                let entity = await this.repository.findOne({
                    where: [
                        { livechart_id: mapping.livechart_id },
                        ...(mal_anilist_composite
                            ? [{ mal_anilist_composite: mal_anilist_composite }]
                            : [])
                    ]
                });

                if (entity) {
                    // Update existing entity
                    Object.assign(entity, mapping, { mal_anilist_composite });
                    await this.repository.save(entity);
                } else {
                    // Create new entity
                    entity = this.repository.create({
                        ...mapping,
                        mal_anilist_composite: mal_anilist_composite || undefined
                    });
                    await this.repository.save(entity);
                }
            } catch (error) {
                Logger.error(`Error processing mapping: ${JSON.stringify(mapping)}: ${error}`, {
                    timestamp: true,
                    prefix: 'FribbSync'
                });
            }
        }
    }
}

// Initialize and export the task configuration
export const fribbSyncTask = {
    name: 'FribbSync',
    interval: 7 * 24 * 60 * 60 * 1000, // 1 week in milliseconds
    execute: async () => {
        const task = new FribbSyncTask();
        await task.execute();
    }
};