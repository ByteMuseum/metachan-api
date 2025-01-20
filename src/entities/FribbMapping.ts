import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from "typeorm";

@Entity()
export class FribbMapping {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ nullable: true, unique: true })
    @Index()
    livechart_id: number;

    @Column({ nullable: true })
    thetvdb_id: number;

    @Column({ name: "anime_planet_id", nullable: true })
    "anime-planet_id": string;

    @Column({ nullable: true })
    imdb_id: string;

    @Column({ nullable: true })
    anisearch_id: number;

    @Column({ nullable: true })
    themoviedb_id: number;

    @Column({ nullable: true })
    anidb_id: number;

    @Column({ nullable: true })
    kitsu_id: number;

    @Column({ nullable: true })
    @Index()
    mal_id: number;

    @Column()
    type: string;

    @Column({ name: "notify_moe_id", nullable: true })
    "notify.moe_id": string;

    @Column({ nullable: true })
    @Index()
    anilist_id: number;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;

    // We'll add composite unique constraints for the IDs we want to ensure uniqueness
    @Index()
    @Column({ nullable: true, unique: true })
    mal_anilist_composite: string;
}