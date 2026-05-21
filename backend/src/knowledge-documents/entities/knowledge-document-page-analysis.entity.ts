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

@Entity('knowledge_document_page_analysis')
export class KnowledgeDocumentPageAnalysis {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  documentId: string;

  @ManyToOne(() => KnowledgeDocument, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'documentId' })
  document: KnowledgeDocument;

  @Column({ type: 'int' })
  pageNumber: number;

  @Column({ type: 'varchar', length: 24 })
  quality: 'good' | 'degraded' | 'poor' | 'unreadable';

  @Column({ type: 'float', nullable: true })
  ocrConfidence: number | null;

  @Column({ type: 'text', nullable: true })
  ocrText: string | null;

  @Column({ type: 'boolean', default: false })
  visionUsed: boolean;

  @Column({ type: 'varchar', length: 24, default: 'raw' })
  processingMode: 'raw' | 'preprocessed' | 'region';

  @Column({ type: 'jsonb', nullable: true })
  qualityWarnings: string[] | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  sectionType: string | null;

  @Column({ type: 'varchar', length: 24, default: 'text' })
  extractionMode: 'text' | 'ocr' | 'vision';

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

