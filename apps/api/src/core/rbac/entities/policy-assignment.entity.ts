import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Napojení policy na subjekt (EPIC-18 Fáze 4). MVP subject: 'membership'. */
@Entity('policy_assignments')
@Index(['subjectType', 'subjectId'])
export class PolicyAssignment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'uuid', name: 'policy_id' })
  policyId!: string;

  @Column({ type: 'text', name: 'subject_type' })
  subjectType!: 'membership';

  @Column({ type: 'uuid', name: 'subject_id' })
  subjectId!: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
