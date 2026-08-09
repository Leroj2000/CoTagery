import { Column, Entity, Index } from 'typeorm';
import type { ObjectPermissionLevel } from '@tagery/shared';
import { BaseTenantEntity } from '../../database/base-tenant.entity';

/** Per-objektové oprávnění (ACL) – ADR/PRD §7. Tenant-scoped (RLS). */
@Entity('object_permissions')
@Index(['digitalObjectId', 'subjectType', 'subjectId'], { unique: true })
export class ObjectPermission extends BaseTenantEntity {
  @Column({ type: 'uuid', name: 'digital_object_id' })
  digitalObjectId!: string;

  @Column({ type: 'text', name: 'subject_type' })
  subjectType!: 'user' | 'group' | 'tenant';

  @Column({ type: 'text', name: 'subject_id' })
  subjectId!: string;

  @Column({ type: 'text' })
  permission!: ObjectPermissionLevel;

  @Column({ type: 'timestamptz', name: 'expires_at', nullable: true })
  expiresAt!: Date | null;
}
