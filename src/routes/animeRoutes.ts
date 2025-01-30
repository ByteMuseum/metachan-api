import { Router } from 'express';
import {
  animeEpisodes,
  episodeStreamingLinks,
  getAnime,
  getAnimeByAnilistId,
  searchAnime,
} from '../controllers/animeController';

const router = Router();

router.get('/search', searchAnime);
router.get('/anilist/:id', getAnimeByAnilistId);
router.get('/:id/episodes', animeEpisodes);
router.get('/:id/episodes/:number', episodeStreamingLinks);
router.get('/:id', getAnime);

export default router;
