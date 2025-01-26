import { Request, Response } from 'express';
import Logger from '../utils/logger';
import { FribbMappingRepository } from '../repositories/FribbMappingRepository';
import { getFullAnime } from '../utils/anime';

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
