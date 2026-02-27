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
import { User } from '../../users/entities/user.entity';
import { Conversation } from './conversation.entity';
import { Attachment } from './attachment.entity';

export enum TicketStatus {
  OPEN = 'open',
  IN_REVIEW = 'in_review',
  IN_PROGRESS = 'in_progress',
  SOLVED = 'solved',
  CLOSED = 'closed',
}

export enum TicketPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum TicketCategory {
  SOFTWARE = 'software',
  HARDWARE = 'hardware',
  ELECTRICAL = 'electrical',
  MECHANICAL = 'mechanical',
  IT = 'it',
  PLUMBING = 'plumbing',
  TASK = 'task',
  OTHER = 'other',
}

export enum TicketSource {
  WEB = 'web',
  WHATSAPP = 'whatsapp',
  EMAIL = 'email',
}

@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('text')
  description: string;

  @Column({
    type: 'enum',
    enum: TicketCategory,
    default: TicketCategory.OTHER,
  })
  category: TicketCategory;

  @Column({
    type: 'enum',
    enum: TicketPriority,
    default: TicketPriority.MEDIUM,
  })
  priority: TicketPriority;

  @Column({
    type: 'enum',
    enum: TicketStatus,
    default: TicketStatus.OPEN,
  })
  status: TicketStatus;

  @Column({ nullable: true })
  subcategory: string;

  @Column({ nullable: true })
  machine: string;

  @Column({ nullable: true })
  area: string;

  @Column({
    type: 'enum',
    enum: TicketSource,
    default: TicketSource.WEB,
  })
  source: TicketSource;

  @Column()
  createdById: string;

  @ManyToOne(() => User, (user) => user.createdTickets)
  @JoinColumn({ name: 'createdById' })
  createdBy: User;

  @Column({ nullable: true })
  assignedToId: string;

  @ManyToOne(() => User, (user) => user.assignedTickets)
  @JoinColumn({ name: 'assignedToId' })
  assignedTo: User;

  @OneToMany(() => Conversation, (conversation) => conversation.ticket)
  conversations: Conversation[];

  @OneToMany(() => Attachment, (attachment) => attachment.ticket)
  attachments: Attachment[];

  @Column({ default: false })
  isDeleted: boolean;

  @Column({ type: 'timestamp', nullable: true })
  deletedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
