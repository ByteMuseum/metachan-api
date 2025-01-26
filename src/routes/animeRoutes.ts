import { Router } from 'express';
import { getAnime } from '../controllers/animeController';

const router = Router();

router.get('/:id', getAnime);

export default router;
