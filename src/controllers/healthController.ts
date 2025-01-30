import { Request, Response } from 'express';
import { getDatabaseStatus } from '../database/data-source';
import { taskManager } from '../tasks/TaskManager';
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
  tasks: Record<
    string,
    {
      registered: boolean;
      running: boolean;
      lastRun?: Date;
      nextRun?: Date;
    }
  >;
}

export const getHealthStatus = async (_req: Request, res: Response): Promise<void> => {
  const authorizationHeader = _req.headers.authorization;
  if (authorizationHeader !== process.env.HEALTH_AUTH_TOKEN) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing authorization token',
    });
    return;
  }

  try {
    const memoryUsage = process.memoryUsage();
    const uptimeInSeconds = process.uptime();
    const dbStatus = await getDatabaseStatus();
    const tasksStatus = await taskManager.getAllTasksStatus();

    const status: HealthStatus = {
      status: dbStatus ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptimeInSeconds),
      memory: {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        free: Math.round((memoryUsage.heapTotal - memoryUsage.heapUsed) / 1024 / 1024),
        usage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
      },
      database: {
        status: dbStatus ? 'connected' : 'disconnected',
        lastChecked: new Date().toISOString(),
      },
      tasks: tasksStatus,
    };

    Logger.info('Health check performed', {
      timestamp: true,
      prefix: 'Health',
    });

    res.json(status);
  } catch (error) {
    Logger.error('Health check failed', {
      timestamp: true,
      prefix: 'Health',
    });
    Logger.debug(error as string);

    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
};
