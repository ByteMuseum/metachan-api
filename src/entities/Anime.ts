import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity()
export class Anime {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    title: string;

    @Column()
    originalTitle: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'int', nullable: true })
    episodeCount: number;

    @Column({ type: 'simple-array', nullable: true })
    genres: string[];

    @Column({ type: 'float', nullable: true })
    rating: number;

    @Column({ nullable: true })
    releaseYear: number;

    @Column({ nullable: true })
    studio: string;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}