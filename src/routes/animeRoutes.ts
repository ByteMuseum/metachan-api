import { Router } from 'express';
import { getAnime, getAnimeByAnilistId, searchAnime } from '../controllers/animeController';

const router = Router();

router.get('/search', searchAnime);
router.get('/:id', getAnime);
router.get('/anilist/:id', getAnimeByAnilistId);

export default router;
