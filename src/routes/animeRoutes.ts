import { Router, Request, Response } from 'express';
import {
  animeEpisodes,
  episodeStreamingLinks,
  getAnime,
  getAnimeByAnilistId,
  searchAnime,
  topAiring,
  topFavorite,
  topPopular,
  topUpcoming,
} from '../controllers/animeController';

const router = Router();
router.get('/', (_req: Request, res: Response) => {
  res.json({
    message: '/anime API Routes',
    endpoints: {
      top: '/top',
      search: '/search',
      anilist: '/anilist/:id',
      episodes: '/:id/episodes',
      episode: '/:id/episodes/:number',
    },
  });
});

router.get('/top', (_req: Request, res: Response) => {
  res.json({
    message: '/anime/top API Routes',
    endpoints: {
      airing: '/airing',
      upcoming: '/upcoming',
      popular: '/popular',
      favorite: '/favorite',
    },
  });
});

router.get('/top/airing', topAiring);
router.get('/top/upcoming', topUpcoming);
router.get('/top/popular', topPopular);
router.get('/top/favorite', topFavorite);
router.get('/search', searchAnime);
router.get('/anilist/:id', getAnimeByAnilistId);
router.get('/:id/episodes', animeEpisodes);
router.get('/:id/episodes/:number', episodeStreamingLinks);
router.get('/:id', getAnime);

export default router;
