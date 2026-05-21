import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('machine_profiles')
export class MachineProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  machineName: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  manufacturer: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  family: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  modelNumber: string | null;

  @Column({ type: 'text', nullable: true })
  components: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
