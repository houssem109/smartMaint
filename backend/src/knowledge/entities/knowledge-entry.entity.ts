import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  RelationId,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { KnowledgeDocument } from '../../knowledge-documents/entities/knowledge-document.entity';

@Entity('knowledge_entries')
export class KnowledgeEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  problemDescription: string;

  @Column({ type: 'text' })
  solution: string;

  @Column({ type: 'text', nullable: true })
  tags: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  entryType: string | null;

  @Column({ type: 'varchar', length: 32, default: 'approved' })
  reviewStatus: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  machineName: string | null;

  @Column({ type: 'text', nullable: true })
  symptom: string | null;

  @Column({ type: 'text', nullable: true })
  rootCause: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  severity: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  source: string | null;

  @Column({ type: 'uuid', nullable: true })
  reviewedById: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  rejectReason: string | null;

  @Column({ type: 'varchar', length: 1024, nullable: true })
  photoPath: string | null;

  /** AI description of field photo — indexed in Qdrant for Techo RAG. */
  @Column({ type: 'text', nullable: true })
  photoVisionDescription: string | null;

  @ManyToOne(() => KnowledgeDocument, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'knowledgeDocumentId' })
  knowledgeDocument?: KnowledgeDocument | null;

  @RelationId((e: KnowledgeEntry) => e.knowledgeDocument)
  knowledgeDocumentId!: string | null;

  @Column()
  createdById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

