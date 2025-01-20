import { Repository } from 'typeorm';
import Logger from '../utils/logger';
import { TaskLog } from '../entities/TaskLog';
import AppDataSource from '../database/data-source';

export interface Task {
    name: string;
    interval: number; // in milliseconds
    execute: () => Promise<void>;
    lastRun?: Date;
}

export class TaskManager {
    private tasks: Map<string, Task> = new Map();
    private intervals: Map<string, NodeJS.Timeout> = new Map();
    private taskLogRepository: Repository<TaskLog>;

    constructor() {
        this.taskLogRepository = AppDataSource.getRepository(TaskLog);
    }

    registerTask(task: Task): void {
        if (this.tasks.has(task.name)) {
            throw new Error(`Task ${task.name} already registered`);
        }

        this.tasks.set(task.name, task);
        Logger.info(`Task ${task.name} registered`, {
            timestamp: true,
            prefix: 'TaskManager'
        });
    }

    private async shouldExecuteTask(taskName: string): Promise<boolean> {
        const lastExecution = await this.taskLogRepository.findOne({
            where: { taskName },
            order: { executedAt: 'DESC' }
        });

        if (!lastExecution) {
            return true;
        }

        const task = this.tasks.get(taskName);
        if (!task) {
            return false;
        }

        const timeSinceLastRun = Date.now() - lastExecution.executedAt.getTime();
        return timeSinceLastRun >= task.interval;
    }

    private async logTaskExecution(taskName: string, status: 'success' | 'error', error?: string): Promise<void> {
        const taskLog = this.taskLogRepository.create({
            taskName,
            status,
            error
        });
        await this.taskLogRepository.save(taskLog);
    }

    async startTask(taskName: string): Promise<void> {
        const task = this.tasks.get(taskName);
        if (!task) {
            throw new Error(`Task ${taskName} not found`);
        }

        // Check if task should run
        const shouldExecute = await this.shouldExecuteTask(taskName);
        if (!shouldExecute) {
            Logger.info(`Skipping task ${taskName} - not due yet`, {
                timestamp: true,
                prefix: 'TaskManager'
            });
            return;
        }

        // Clear any existing interval
        this.stopTask(taskName);

        // Execute task
        try {
            await task.execute();
            task.lastRun = new Date();
            await this.logTaskExecution(taskName, 'success');
            Logger.success(`Task ${taskName} executed successfully`, {
                timestamp: true,
                prefix: 'TaskManager'
            });
        } catch (error) {
            await this.logTaskExecution(taskName, 'error', error instanceof Error ? error.message : String(error));
            Logger.error(`Task ${taskName} failed: ${error}`, {
                timestamp: true,
                prefix: 'TaskManager'
            });
        }

        // Schedule next run
        const interval = setInterval(async () => {
            try {
                await task.execute();
                task.lastRun = new Date();
                await this.logTaskExecution(taskName, 'success');
                Logger.success(`Task ${taskName} executed successfully`, {
                    timestamp: true,
                    prefix: 'TaskManager'
                });
            } catch (error) {
                await this.logTaskExecution(taskName, 'error', error instanceof Error ? error.message : String(error));
                Logger.error(`Task ${taskName} failed: ${error}`, {
                    timestamp: true,
                    prefix: 'TaskManager'
                });
            }
        }, task.interval);

        this.intervals.set(taskName, interval);
        Logger.info(`Task ${taskName} scheduled with interval ${task.interval}ms`, {
            timestamp: true,
            prefix: 'TaskManager'
        });
    }

    stopTask(taskName: string): void {
        const interval = this.intervals.get(taskName);
        if (interval) {
            clearInterval(interval);
            this.intervals.delete(taskName);
            Logger.info(`Task ${taskName} stopped`, {
                timestamp: true,
                prefix: 'TaskManager'
            });
        }
    }

    async startAllTasks(): Promise<void> {
        for (const taskName of this.tasks.keys()) {
            await this.startTask(taskName);
        }
    }

    stopAllTasks(): void {
        for (const taskName of this.intervals.keys()) {
            this.stopTask(taskName);
        }
    }

    async getTaskStatus(taskName: string): Promise<{
        registered: boolean;
        running: boolean;
        lastRun?: Date;
        nextRun?: Date;
    }> {
        const task = this.tasks.get(taskName);
        const interval = this.intervals.get(taskName);
        const lastExecution = await this.taskLogRepository.findOne({
            where: { taskName },
            order: { executedAt: 'DESC' }
        });

        let nextRun: Date | undefined;
        if (lastExecution) {
            nextRun = new Date(lastExecution.executedAt.getTime() + (task?.interval || 0));
        }

        return {
            registered: !!task,
            running: !!interval,
            lastRun: lastExecution?.executedAt,
            nextRun
        };
    }

    async getAllTasksStatus(): Promise<Record<string, {
        registered: boolean;
        running: boolean;
        lastRun?: Date;
        nextRun?: Date;
    }>> {
        const status: Record<string, {
            registered: boolean;
            running: boolean;
            lastRun?: Date;
            nextRun?: Date;
        }> = {};
        for (const [taskName] of this.tasks) {
            status[taskName] = await this.getTaskStatus(taskName);
        }
        return status;
    }
}

export const taskManager = new TaskManager();