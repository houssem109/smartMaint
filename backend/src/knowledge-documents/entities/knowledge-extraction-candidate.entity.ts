import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { KnowledgeDocument } from './knowledge-document.entity';
import { User } from '../../users/entities/user.entity';
import { KnowledgeExtractionTechReview } from './knowledge-extraction-tech-review.entity';

export type KnowledgeExtractionStatus = 'candidate' | 'approved' | 'rejected';
export type TechExtractionReviewStatus = 'approve' | 'approve_edit' | 'reject';

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

  @Column({ type: 'uuid', nullable: true })
  reviewedById: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reviewedById' })
  reviewedBy: User | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  techReviewStatus: TechExtractionReviewStatus | null;

  @Column({ type: 'uuid', nullable: true })
  techReviewedById: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'techReviewedById' })
  techReviewedBy: User | null;

  @Column({ type: 'timestamptz', nullable: true })
  techReviewedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  techEditedTitle: string | null;

  @Column({ type: 'text', nullable: true })
  techEditedProblemDescription: string | null;

  @Column({ type: 'text', nullable: true })
  techEditedSolution: string | null;

  @Column({ type: 'text', nullable: true })
  techRejectReason: string | null;

  @OneToMany(() => KnowledgeExtractionTechReview, (r) => r.candidate)
  techReviews: KnowledgeExtractionTechReview[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

