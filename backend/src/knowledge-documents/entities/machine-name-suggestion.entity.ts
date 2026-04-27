import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { KnowledgeDocument } from './knowledge-document.entity';

export type MachineNameSuggestionStatus = 'pending' | 'approved' | 'rejected';

@Entity('machine_name_suggestions')
export class MachineNameSuggestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  documentId: string;

  @ManyToOne(() => KnowledgeDocument, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'documentId' })
  document: KnowledgeDocument;

  @Column()
  suggestedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'suggestedById' })
  suggestedBy: User;

  @Column({ type: 'varchar', length: 500 })
  proposedName: string;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status: MachineNameSuggestionStatus;

  @Column({ type: 'text', nullable: true })
  rejectReason: string | null;

  @Column({ type: 'uuid', nullable: true })
  reviewedById: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reviewedById' })
  reviewedBy: User | null;

  @Column({ type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
