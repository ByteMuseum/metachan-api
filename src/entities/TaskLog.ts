import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity()
export class TaskLog {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    taskName: string;

    @Column()
    status: 'success' | 'error';

    @Column({ type: 'text', nullable: true })
    error?: string;

    @CreateDateColumn()
    executedAt: Date;
}