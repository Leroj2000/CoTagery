import { Column, Entity } from 'typeorm';
import { BaseTenantEntity } from '../../database/base-tenant.entity';

/** Lokace tenantu (obchod, sklad, kancelář…). Tenant-scoped → chráněno RLS. */
@Entity('locations')
export class Location extends BaseTenantEntity {
  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', default: 'store' })
  type!: 'store' | 'venue' | 'warehouse' | 'office' | 'home';

  @Column({ type: 'text', nullable: true })
  address!: string | null;

  @Column({ type: 'text', default: 'Europe/Prague' })
  timezone!: string;

  /** Nadřazená lokace – stromová hierarchie (Firma → Sklad → Regál → Police). */
  @Column({ type: 'uuid', name: 'parent_id', nullable: true })
  parentId!: string | null;
}
