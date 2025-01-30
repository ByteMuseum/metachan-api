import { Router, Request, Response } from 'express';
import healthRoutes from './healthRoutes';
import animeRoutes from './animeRoutes';

const router = Router();

// API documentation route
router.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'MetaChan API v1',
    endpoints: {
      health: '/health',
      anime: '/anime',
    },
  });
});

// Mount routes
router.use('/health', healthRoutes);
router.use('/anime', animeRoutes);

export default router;
