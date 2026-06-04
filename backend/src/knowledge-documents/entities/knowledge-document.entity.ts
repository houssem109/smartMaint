import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export type KnowledgeDocumentStatus =
  | 'uploaded'
  | 'gated'
  | 'needs_review'
  | 'rejected'
  | 'processing'
  | 'partially_indexed'
  | 'done'
  | 'failed'
  /** Replaced by a newer upload linked via supersession (11). */
  | 'superseded';

@Entity('knowledge_documents')
export class KnowledgeDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  fileName: string;

  @Column()
  originalName: string;

  @Column()
  mimeType: string;

  @Column({ type: 'bigint', default: 0 })
  fileSize: number;

  @Column()
  filePath: string;

  @Column({ type: 'varchar', default: 'uploaded' })
  status: KnowledgeDocumentStatus;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ type: 'int', default: 0 })
  chunksIndexed: number;

  /** Official display name (from extraction, admin edit, or approved suggestion). */
  @Column({ type: 'varchar', length: 500, nullable: true })
  machineName: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  docType: string | null;

  @Column({ type: 'boolean', nullable: true })
  isWorkRelated: boolean | null;

  @Column({ type: 'float', nullable: true })
  gateConfidence: number | null;

  @Column({ type: 'boolean', default: true })
  deepMode: boolean;

  @Column({ type: 'boolean', default: false })
  needsReview: boolean;

  @Column({ type: 'int', default: 0 })
  totalPages: number;

  @Column({ type: 'int', default: 0 })
  pagesProcessed: number;

  @Column({ type: 'int', default: 0 })
  lastProcessedPage: number;

  @Column({ type: 'int', default: 0 })
  progressPercent: number;

  @Column({ type: 'varchar', length: 64, nullable: true })
  currentStage: string | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  fingerprint: string | null;

  @Column({ type: 'uuid', nullable: true })
  machineProfileId: string | null;

  /** When set, this upload is a successor revision of that document (11). */
  @Column({ type: 'uuid', nullable: true })
  supersedesDocumentId: string | null;

  /** When set, a newer document has replaced this row in the active library. */
  @Column({ type: 'uuid', nullable: true })
  supersededByDocumentId: string | null;

  @Column({ type: 'boolean', default: false })
  machineUnknown: boolean;

  @Column()
  uploadedById: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'uploadedById' })
  uploadedBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

