import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('knowledge_document_jobs')
export class KnowledgeDocumentJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  documentId: string;

  @Column({ type: 'varchar', length: 64 })
  queueName: string;

  @Column({ type: 'varchar', length: 64 })
  jobType: string;

  @Column({ type: 'varchar', length: 32, default: 'queued' })
  status: 'queued' | 'active' | 'completed' | 'failed';

  @Column({ type: 'int', default: 0 })
  progressPercent: number;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  bullJobId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
