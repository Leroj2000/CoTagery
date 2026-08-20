import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Auditní událost citlivé změny (EPIC-18 Fáze 4). Append-only, before/after. */
@Entity('audit_events')
@Index(['tenantId', 'createdAt'])
export class AuditEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'uuid', name: 'actor_user_id', nullable: true })
  actorUserId!: string | null;

  @Column({ type: 'text' })
  action!: string;

  @Column({ type: 'text', name: 'target_type', nullable: true })
  targetType!: string | null;

  @Column({ type: 'text', name: 'target_id', nullable: true })
  targetId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  before!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  after!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  context!: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
