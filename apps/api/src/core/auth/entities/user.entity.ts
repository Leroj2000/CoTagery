import { Column, Entity, Index } from 'typeorm';
import type { TenantRole } from '@tagery/shared';
import { BaseTenantEntity } from '../../database/base-tenant.entity';

/**
 * Minimální User pro EPIC-01 (Auth). Plný doménový model (Location, Group…)
 * přijde v EPIC-03-CORE-DOMAIN, který tuto entitu rozšíří.
 */
@Entity('users')
@Index(['tenantId', 'email'], { unique: true })
// EPIC-18: globální identita – email unikátní napříč organizacemi.
@Index('ux_users_email', ['email'], { unique: true })
export class User extends BaseTenantEntity {
  @Column({ type: 'text' })
  email!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', name: 'password_hash' })
  passwordHash!: string;

  @Column({ type: 'text', name: 'tenant_role', default: 'VIEWER' })
  tenantRole!: TenantRole;

  @Column({ type: 'text', default: 'active' })
  status!: 'pending' | 'active' | 'suspended';

  /** Globální provozovatel (Tagery) – smí zakládat/vidět všechny firmy (ADR-0009). */
  @Column({ type: 'boolean', name: 'is_platform_admin', default: false })
  isPlatformAdmin!: boolean;
}
