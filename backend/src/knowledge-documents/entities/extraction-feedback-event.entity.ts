import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export type ExtractionFeedbackSignal = 'approve' | 'approve_edit' | 'reject';

@Entity('extraction_feedback_events')
export class ExtractionFeedbackEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  documentId: string;

  @Column({ type: 'uuid' })
  candidateId: string;

  @Column({ type: 'varchar', length: 32 })
  signal: ExtractionFeedbackSignal;

  @Column({ type: 'varchar', length: 64, nullable: true })
  docType: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  sectionType: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  entryType: string | null;

  @Column({ type: 'float', nullable: true })
  confidence: number | null;

  @Column({ type: 'uuid', nullable: true })
  adminId: string | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'jsonb', nullable: true })
  editDelta: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
