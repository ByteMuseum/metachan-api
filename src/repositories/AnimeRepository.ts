import { Like } from "typeorm";
import { BaseRepository } from "./BaseRepository";
import { Anime } from "../entities/Anime";
import Logger from "../utils/logger";

export class AnimeRepository extends BaseRepository<Anime> {
    constructor() {
        super(Anime);
    }

    async findByTitle(title: string): Promise<Anime[]> {
        try {
            return await this.repository.findBy({
                title: Like(`%${title}%`)
            });
        } catch (error) {
            Logger.error("Error finding anime by title", { timestamp: true, prefix: "Database" });
            throw error;
        }
    }

    async findByGenre(genre: string): Promise<Anime[]> {
        try {
            const allAnime = await this.repository.find();
            return allAnime.filter(anime => anime.genres?.includes(genre));
        } catch (error) {
            Logger.error("Error finding anime by genre", { timestamp: true, prefix: "Database" });
            throw error;
        }
    }
}

export const animeRepository = new AnimeRepository();