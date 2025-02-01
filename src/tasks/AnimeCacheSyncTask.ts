/* File disabled until further requirements */

// import { FribbMapping } from '../entities/FribbMapping';
// import { fribbMappingRepository } from '../repositories/FribbMappingRepository';
// import { animeCacheRepository } from '../repositories/AnimeCacheRepository';
// import { getFullAnime } from '../utils/anime';
// import { getEpisodeStreamingLinks } from '../utils/stream';
// import Logger from '../utils/logger';
// import { Task } from './TaskManager';

// export class AnimeCacheSyncTask {
//   private readonly DELAY_BETWEEN_ITEMS = 2000; // 2 seconds delay between processing each anime

//   async execute(): Promise<void> {
//     try {
//       Logger.info('Starting anime cache sync', { timestamp: true, prefix: 'AnimeCacheSync' });

//       // Get all FribbMappings
//       const mappings = await fribbMappingRepository.findAll();
//       const totalMappings = mappings.length;
//       let processed = 0;

//       // Process one mapping at a time with delay
//       for (const mapping of mappings) {
//         if (!mapping.mal_id) {
//           processed++;
//           continue;
//         }

//         try {
//           await this.processAnime(mapping);
//           processed++;

//           Logger.info(`Processed ${processed}/${totalMappings} anime entries`, {
//             timestamp: true,
//             prefix: 'AnimeCacheSync',
//           });

//           // Add delay between processing each anime to avoid rate limiting
//           await new Promise((resolve) => setTimeout(resolve, this.DELAY_BETWEEN_ITEMS));
//         } catch (error) {
//           Logger.error(`Error processing MAL ID ${mapping.mal_id}: ${error}`, {
//             timestamp: true,
//             prefix: 'AnimeCacheSync',
//           });
//           // Continue with next anime even if current one fails
//           processed++;
//         }
//       }

//       Logger.success('Anime cache sync completed', { timestamp: true, prefix: 'AnimeCacheSync' });
//     } catch (error) {
//       Logger.error(`Anime cache sync failed: ${error}`, {
//         timestamp: true,
//         prefix: 'AnimeCacheSync',
//       });
//       throw error;
//     }
//   }

//   private async processAnime(mapping: FribbMapping): Promise<void> {
//     // Check if anime is cached
//     const cachedAnime = await animeCacheRepository.getCachedAnime(mapping.mal_id);

//     if (!cachedAnime) {
//       Logger.info(`Caching anime data for MAL ID: ${mapping.mal_id}`, {
//         timestamp: true,
//         prefix: 'AnimeCacheSync',
//       });

//       // Get and cache anime data
//       const anime = await getFullAnime(mapping);
//       if (!anime) return;

//       // Cache streaming links for each episode one by one
//       if (anime.episodes && anime.episodes.episodes.length > 0) {
//         const title = anime.titles.romaji || anime.titles.english || anime.titles.japanese;

//         for (const episode of anime.episodes.episodes) {
//           if (!episode.number) continue;

//           // Check if streaming links are cached
//           const cachedLinks = await animeCacheRepository.getCachedStreamingLinks(
//             mapping.mal_id,
//             episode.number,
//           );

//           if (!cachedLinks) {
//             Logger.info(
//               `Caching streaming links for MAL ID: ${mapping.mal_id}, Episode: ${episode.number}`,
//               { timestamp: true, prefix: 'AnimeCacheSync' },
//             );

//             const links = await getEpisodeStreamingLinks(title, episode.number, mapping.mal_id);
//             if (links.sub.length > 0 || links.dub.length > 0) {
//               await animeCacheRepository.cacheStreamingLinks(mapping.mal_id, episode.number, links);
//             }

//             // Add delay between processing each episode
//             await new Promise((resolve) => setTimeout(resolve, 1000));
//           }
//         }
//       }
//     }
//   }
// }

// export const animeCacheSyncTask: Task = {
//   name: 'AnimeCacheSync',
//   interval: 24 * 60 * 60 * 1000, // 24 hours
//   execute: async () => {
//     const task = new AnimeCacheSyncTask();
//     await task.execute();
//   },
// };
