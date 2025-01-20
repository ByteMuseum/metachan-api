// src/routes/index.ts
import { Router, Request, Response } from 'express';
import healthRoutes from './healthRoutes';

const router = Router();

// API documentation route
router.get('/', (_req: Request, res: Response) => {
    res.json({
        message: 'MetaChan API v1',
        endpoints: {
            health: '/health'
        }
    });
});

// Mount routes
router.use('/health', healthRoutes);

export default router;