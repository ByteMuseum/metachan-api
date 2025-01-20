// src/repositories/BaseRepository.ts
import { Repository, DeepPartial, FindOptionsWhere, ObjectLiteral } from "typeorm";
import AppDataSource from "../database/data-source";
import Logger from "../utils/logger";

interface BaseEntity {
    id: number;
}

export class BaseRepository<T extends ObjectLiteral & BaseEntity> {
    protected repository: Repository<T>;
    protected entityName: string;

    constructor(entity: { new(): T }) {
        this.repository = AppDataSource.getRepository<T>(entity);
        this.entityName = entity.name;
    }

    async create(data: DeepPartial<T>): Promise<T> {
        try {
            const entity = this.repository.create(data);
            const saved = await this.repository.save(entity);
            Logger.info(`Created ${this.entityName}`, { timestamp: true, prefix: "Database" });
            return saved;
        } catch (error) {
            Logger.error(`Error creating ${this.entityName}`, { timestamp: true, prefix: "Database" });
            throw error;
        }
    }

    async findById(id: number): Promise<T | null> {
        try {
            return await this.repository.findOneBy({ id } as FindOptionsWhere<T>);
        } catch (error) {
            Logger.error(`Error finding ${this.entityName} by id`, { timestamp: true, prefix: "Database" });
            throw error;
        }
    }

    async findAll(): Promise<T[]> {
        try {
            return await this.repository.find();
        } catch (error) {
            Logger.error(`Error finding all ${this.entityName}s`, { timestamp: true, prefix: "Database" });
            throw error;
        }
    }

    async update(id: number, data: DeepPartial<T>): Promise<T | null> {
        try {
            await this.repository.update(id, data);
            return this.findById(id);
        } catch (error) {
            Logger.error(`Error updating ${this.entityName}`, { timestamp: true, prefix: "Database" });
            throw error;
        }
    }

    async delete(id: number): Promise<boolean> {
        try {
            const result = await this.repository.delete(id);
            return result.affected ? result.affected > 0 : false;
        } catch (error) {
            Logger.error(`Error deleting ${this.entityName}`, { timestamp: true, prefix: "Database" });
            throw error;
        }
    }
}