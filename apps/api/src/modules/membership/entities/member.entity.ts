import { Column, Entity, Index } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';

/**
 * Per-tenant identita člena (EPIC-16). Sdílená s Loyalty (`Member` ≈ `Customer`);
 * backlog počítá se sjednocením do `Party`/`Person`.
 */
@Entity('members')
@Index(['tenantId', 'email'], { unique: true, where: 'email IS NOT NULL' })
export class Member extends BaseTenantEntity {
  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  email!: string | null;

  @Column({ type: 'text', nullable: true })
  phone!: string | null;

  /** Volitelná externí reference (CRM, e-shop účet). */
  @Column({ type: 'text', name: 'external_ref', nullable: true })
  externalRef!: string | null;
}
