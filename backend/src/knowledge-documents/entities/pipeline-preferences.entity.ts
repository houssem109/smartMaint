import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Single-row runtime preferences for the PDF pipeline (singleton id). */
@Entity('pipeline_preferences')
export class PipelinePreferences {
  static readonly SINGLETON_ID = '00000000-0000-0000-0000-000000000001';

  @PrimaryColumn('uuid')
  id: string;

  /** Admin UI toggle: when false, vision jobs are skipped even if ENABLE_PDF_VISION is true in env. */
  @Column({ type: 'boolean', default: true })
  pdfVisionEnabled: boolean;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  updatedById: string | null;
}
