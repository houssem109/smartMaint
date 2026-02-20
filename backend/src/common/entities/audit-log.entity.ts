import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum ActionType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  APPROVE = 'approve',
  REJECT = 'reject',
  ROLLBACK = 'rollback',
}

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ActionType,
  })
  actionType: ActionType;

  @Column()
  entityId: string;

  @Column()
  entityType: string;

  @Column({ nullable: true })
  userId: string;

  @Column('jsonb', { nullable: true })
  changes: Record<string, any>;

  @Column('text', { nullable: true })
  reason: string;

  @CreateDateColumn()
  timestamp: Date;
}
