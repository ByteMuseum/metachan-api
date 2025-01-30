import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity()
export class AnimeCache {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @Index()
  malId: number;

  @Column({ nullable: true })
  episodeNumber: number;

  @Column({ type: 'text' })
  data: string;

  @Column()
  type: 'anime' | 'stream';

  @Column()
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
