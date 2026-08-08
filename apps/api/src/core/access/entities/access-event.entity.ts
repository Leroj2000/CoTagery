import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Auditní záznam průchodu (allow/deny) – ADR-0006. */
@Entity('access_events')
export class AccessEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'uuid', name: 'access_point_id' })
  accessPointId!: string;

  @Column({ type: 'text', name: 'subject_type' })
  subjectType!: string;

  @Column({ type: 'text', name: 'subject_ref' })
  subjectRef!: string;

  @Column({ type: 'text' })
  decision!: 'allow' | 'deny';

  @Column({ type: 'text', nullable: true })
  reason!: string | null;

  @Column({ type: 'text', name: 'entitlement_ref', nullable: true })
  entitlementRef!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
