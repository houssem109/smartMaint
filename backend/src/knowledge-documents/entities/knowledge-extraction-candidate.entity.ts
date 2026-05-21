import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { KnowledgeDocument } from './knowledge-document.entity';

export type KnowledgeExtractionStatus = 'candidate' | 'approved' | 'rejected';

@Entity('knowledge_extraction_candidates')
export class KnowledgeExtractionCandidate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  documentId: string;

  @ManyToOne(() => KnowledgeDocument)
  @JoinColumn({ name: 'documentId' })
  document: KnowledgeDocument;

  @Column()
  title: string;

  @Column({ type: 'text' })
  problemDescription: string;

  @Column({ type: 'text' })
  solution: string;

  @Column({ type: 'text', nullable: true })
  tags: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  entryType: string | null;

  @Column({ type: 'text', nullable: true })
  symptom: string | null;

  @Column({ type: 'text', nullable: true })
  rootCause: string | null;

  @Column({ type: 'text', nullable: true })
  sourcePages: string | null;

  @Column({ type: 'float', nullable: true })
  confidence: number | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  sectionType: string | null;

  @Column({ type: 'varchar', default: 'candidate' })
  status: KnowledgeExtractionStatus;

  @Column()
  createdById: string;

  @Column({ type: 'varchar', nullable: true })
  reviewedById: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

