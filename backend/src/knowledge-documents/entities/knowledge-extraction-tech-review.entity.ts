import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { KnowledgeExtractionCandidate } from './knowledge-extraction-candidate.entity';
import { User } from '../../users/entities/user.entity';

export type TechExtractionReviewAction = 'approve' | 'approve_edit' | 'reject';

@Entity('knowledge_extraction_tech_reviews')
@Unique('UQ_extraction_tech_review_candidate_technician', ['candidateId', 'technicianId'])
export class KnowledgeExtractionTechReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  candidateId: string;

  @ManyToOne(() => KnowledgeExtractionCandidate, (c) => c.techReviews, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'candidateId' })
  candidate: KnowledgeExtractionCandidate;

  @Column()
  technicianId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'technicianId' })
  technician: User;

  @Column({ type: 'varchar', length: 32 })
  action: TechExtractionReviewAction;

  @Column({ type: 'text', nullable: true })
  editedTitle: string | null;

  @Column({ type: 'text', nullable: true })
  editedProblemDescription: string | null;

  @Column({ type: 'text', nullable: true })
  editedSolution: string | null;

  @Column({ type: 'text', nullable: true })
  rejectReason: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
