import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Ticket } from './ticket.entity';

export enum SenderType {
  USER = 'user',
  AI = 'ai',
  SYSTEM = 'system',
}

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  ticketId: string | null;

  @ManyToOne(() => Ticket, (ticket) => ticket.conversations)
  @JoinColumn({ name: 'ticketId' })
  ticket: Ticket;

  @Column('text')
  message: string;

  @Column({
    type: 'enum',
    enum: SenderType,
    default: SenderType.USER,
  })
  senderType: SenderType;

  @Column({ nullable: true })
  senderId: string;

  /** Techo widget thread id (client-generated) for long chat memory across sessions. */
  @Column({ type: 'varchar', length: 128, nullable: true })
  threadId: string | null;

  @CreateDateColumn()
  timestamp: Date;
}
