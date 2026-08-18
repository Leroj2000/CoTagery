import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Přiřazení role na membership se scope a časovou platností (EPIC-18 Fáze 0).
 * `role_key` zatím nese legacy roli (text); ve Fázi 1 se naváže na katalog
 * `roles` (role_id). Scope pro MVP: ORGANIZATION (dále LOCATION_TREE/OWN).
 */
@Entity('role_assignments')
@Index(['membershipId'])
export class RoleAssignment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'uuid', name: 'membership_id' })
  membershipId!: string;

  @Column({ type: 'text', name: 'role_key' })
  roleKey!: string;

  @Column({ type: 'text', name: 'scope_type', default: 'ORGANIZATION' })
  scopeType!: 'ORGANIZATION' | 'LOCATION_TREE' | 'LOCATION_SET' | 'OWN' | 'RESOURCE_SET';

  @Column({ type: 'uuid', name: 'scope_ref', nullable: true })
  scopeRef!: string | null;

  @Column({ type: 'timestamptz', name: 'valid_from' })
  validFrom!: Date;

  @Column({ type: 'timestamptz', name: 'valid_to', nullable: true })
  validTo!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
