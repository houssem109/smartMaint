import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('admin_page_fix_queue')
export class AdminPageFixQueueItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  documentId: string;

  @Column({ type: 'int' })
  pageNumber: number;

  @Column({ type: 'varchar', length: 24, default: 'open' })
  status: 'open' | 'fixed' | 'dismissed';

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'text', nullable: true })
  adminFixedText: string | null;

  /** Relative path under cwd, e.g. uploads/knowledge-documents/page-fix-images/uuid.png */
  @Column({ type: 'varchar', length: 1024, nullable: true })
  replacementImagePath: string | null;

  @Column({ type: 'uuid', nullable: true })
  fixedByAdminId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  fixedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
