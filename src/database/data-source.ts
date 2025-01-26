import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { join } from 'path';
import Logger from '../utils/logger';

const AppDataSource = new DataSource({
  type: 'sqlite',
  database: 'database.sqlite',
  synchronize: true,
  logging: false,
  entities: [join(__dirname, '../entities/**/*.{ts,js}')],
  migrations: [join(__dirname, '../migrations/**/*.{ts,js}')],
  subscribers: [],
});

export const initializeDatabase = async (): Promise<DataSource> => {
  try {
    const dataSource = await AppDataSource.initialize();
    Logger.success('Database initialized', { timestamp: true, prefix: 'Database' });
    return dataSource;
  } catch (error) {
    Logger.error('Error during database initialization', { timestamp: true, prefix: 'Database' });
    throw error;
  }
};

export const getDatabaseStatus = async (): Promise<boolean> => {
  try {
    // For SQLite, we'll do a simple query to check if the database is responding
    await AppDataSource.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
};

export default AppDataSource;
