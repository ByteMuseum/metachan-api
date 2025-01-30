import { Request, Response } from 'express';
import Logger from '../utils/logger';
import { FribbMappingRepository } from '../repositories/FribbMappingRepository';
import { getFullAnime, searchAnimeQuery } from '../utils/anime';
import type { SearchQueryParams } from '../utils/anime';
import { getEpisodeStreamingLinks } from '../utils/stream';

const fribbMappingRepository = new FribbMappingRepository();

export const getAnime = async (req: Request, res: Response): Promise<void> => {
  const malId = req.params.id;

  try {
    const fribbMapping = await fribbMappingRepository.findByMalId(parseInt(malId));
    if (!fribbMapping) {
      res.status(404).json({ message: 'Anime not found' });
      return;
    }

    const animeResponse = await getFullAnime(fribbMapping);

    res.json(animeResponse);
  } catch (error) {
    Logger.error('Error getting anime', { timestamp: true, prefix: 'Anime' });
    Logger.debug(error as string, { timestamp: true, prefix: 'Anime' });
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getAnimeByAnilistId = async (req: Request, res: Response): Promise<void> => {
  const anilistId = req.params.id;

  try {
    const fribbMapping = await fribbMappingRepository.findByAnilistId(parseInt(anilistId));
    if (!fribbMapping) {
      res.status(404).json({ message: 'Anime not found' });
      return;
    }

    const animeResponse = await getFullAnime(fribbMapping);

    res.json(animeResponse);
  } catch (error) {
    Logger.error('Error getting anime', { timestamp: true, prefix: 'Anime' });
    Logger.debug(error as string, { timestamp: true, prefix: 'Anime' });
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const searchAnime = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      q = '',
      page = 1,
      limit = 25,
      type,
      score,
      min_score,
      max_score,
      status,
      rating,
      sfw,
      genres,
      genres_exclude,
      order_by,
      sort,
      letter,
      producers,
      start_date,
      end_date,
    } = req.query;

    // Type validation for numeric parameters
    const searchParams: SearchQueryParams = {
      q: q as string,
      page: page ? parseInt(page as string, 10) : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      type: type as SearchQueryParams['type'],
      score: score ? parseFloat(score as string) : undefined,
      min_score: min_score ? parseFloat(min_score as string) : undefined,
      max_score: max_score ? parseFloat(max_score as string) : undefined,
      status: status as SearchQueryParams['status'],
      rating: rating as SearchQueryParams['rating'],
      sfw: sfw ? sfw === 'true' : undefined,
      genres: genres as string,
      genres_exclude: genres_exclude as string,
      order_by: order_by as SearchQueryParams['order_by'],
      sort: sort as SearchQueryParams['sort'],
      letter: letter as string,
      producers: producers as string,
      start_date: start_date as string,
      end_date: end_date as string,
    };

    const results = await searchAnimeQuery(searchParams);
    res.json(results);
  } catch (error) {
    Logger.error(error instanceof Error ? error : 'Error processing search request', {
      prefix: 'Anime Search',
      timestamp: true,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const animeEpisodes = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!id) {
    res.status(400).json({ message: 'Invalid request' });
    return;
  }

  const fribbMapping = await fribbMappingRepository.findByMalId(parseInt(id));
  if (!fribbMapping) {
    res.status(404).json({ message: 'Anime not found' });
    return;
  }

  const anime = await getFullAnime(fribbMapping);

  if (!anime) {
    res.status(404).json({ message: 'Anime not found on Jikan' });
    return;
  }

  res.json(anime.episodes);
};

export const episodeStreamingLinks = async (req: Request, res: Response): Promise<void> => {
  const { id, number } = req.params;

  if (!id || !number) {
    res.status(400).json({ message: 'Invalid request' });
    return;
  }

  const fribbMapping = await fribbMappingRepository.findByMalId(parseInt(id));
  if (!fribbMapping) {
    res.status(404).json({ message: 'Anime not found' });
    return;
  }

  const episodeNumber = parseInt(number) ?? 1;
  const anime = await getFullAnime(fribbMapping);

  if (!anime) {
    res.status(404).json({ message: 'Anime not found on Jikan' });
    return;
  }

  const title = anime.titles.romaji || anime.titles.english || anime.titles.japanese;
  if (anime.episodes.episodes.length < episodeNumber) {
    res.status(404).json({ message: 'Episode not found' });
    return;
  }

  const links = await getEpisodeStreamingLinks(title, episodeNumber);
  if (!links) {
    res.status(404).json({ message: 'No streaming links found' });
    return;
  }

  let episodeMetadata = anime.episodes.episodes.find((episode) => episode.number === episodeNumber);

  res.json({ ...episodeMetadata, streamingLinks: links });
};
