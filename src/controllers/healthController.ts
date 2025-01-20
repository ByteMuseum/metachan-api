// src/controllers/healthController.ts
import { Request, Response } from 'express';
import { getDatabaseStatus } from '../database/data-source';
import Logger from '../utils/logger';

interface HealthStatus {
    status: 'healthy' | 'unhealthy';
    timestamp: string;
    uptime: number;
    memory: {
        used: number;
        total: number;
        free: number;
        usage: number;
    };
    database: {
        status: 'connected' | 'disconnected';
        lastChecked: string;
    };
}

export const getHealthStatus = async (_req: Request, res: Response): Promise<void> => {
    try {
        const memoryUsage = process.memoryUsage();
        const uptimeInSeconds = process.uptime();
        const dbStatus = await getDatabaseStatus();

        const status: HealthStatus = {
            status: dbStatus ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            uptime: Math.floor(uptimeInSeconds),
            memory: {
                used: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
                total: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
                free: Math.round((memoryUsage.heapTotal - memoryUsage.heapUsed) / 1024 / 1024), // MB
                usage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100) // Percentage
            },
            database: {
                status: dbStatus ? 'connected' : 'disconnected',
                lastChecked: new Date().toISOString()
            }
        };

        Logger.info('Health check performed', {
            timestamp: true,
            prefix: 'Health'
        });

        res.json(status);
    } catch (error) {
        Logger.error('Health check failed', {
            timestamp: true,
            prefix: 'Health'
        });
        Logger.debug(error as string);

        res.status(500).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: 'Health check failed'
        });
    }
};