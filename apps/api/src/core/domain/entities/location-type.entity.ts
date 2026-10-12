import { Column, Entity, Index } from 'typeorm';
import type { LocationCategory } from '@tagery/shared';
import { BaseTenantEntity } from '../../database/base-tenant.entity';

/** Přepsání systémového typu místa nebo vlastní typ firmy (viz `mergeLocationTypes`). */
@Entity('location_types')
@Index(['tenantId', 'key'], { unique: true })
export class LocationTypeRow extends BaseTenantEntity {
  @Column({ type: 'text' })
  key!: string;

  @Column({ type: 'text', nullable: true })
  name!: string | null;

  @Column({ type: 'text', nullable: true })
  category!: LocationCategory | null;

  @Column({ type: 'boolean', nullable: true })
  grid!: boolean | null;

  @Column({ type: 'boolean', default: false })
  hidden!: boolean;

  @Column({ type: 'integer', name: 'sort_order', nullable: true })
  sortOrder!: number | null;
}
