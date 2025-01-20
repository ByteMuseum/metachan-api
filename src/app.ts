import express, { Request, Response, NextFunction } from 'express';
import { initializeDatabase } from './database/data-source';
import Logger from './utils/logger';
import routes from './routes';
import { taskManager } from './tasks/TaskManager';
import { fribbSyncTask } from './tasks/FribbSyncTask';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
    Logger.info(`${req.method} ${req.url}`, {
        timestamp: true,
        prefix: 'Request'
    });
    next();
});

// Mount routes
app.use('/', routes);

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    Logger.error(err, {
        timestamp: true,
        prefix: `Request ${req.method} ${req.url}`
    });

    if (res.headersSent) {
        return next(err);
    }

    res.status(500).json({
        error: process.env.NODE_ENV === 'production'
            ? 'Internal Server Error'
            : err.message
    });
});

// 404 handler
app.use((_req: Request, res: Response) => {
    res.status(404).json({
        error: 'Not Found',
        message: 'The requested resource was not found'
    });
});

// Initialize tasks and start server
const startServer = async () => {
    try {
        // Initialize database
        await initializeDatabase();

        // Register and start tasks
        taskManager.registerTask(fribbSyncTask);
        await taskManager.startAllTasks();

        // Start server
        app.listen(port, () => {
            Logger.success(`Server running at http://localhost:${port}`, {
                timestamp: true,
                prefix: 'Server'
            });
        });
    } catch (error) {
        Logger.error('Failed to start server', {
            timestamp: true,
            prefix: 'Server'
        });
        Logger.debug(error as string);
        process.exit(1);
    }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
    taskManager.stopAllTasks();
    process.exit(0);
});

startServer();

export default app;