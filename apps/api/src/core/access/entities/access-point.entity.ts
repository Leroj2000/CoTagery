import { Column, Entity } from 'typeorm';
import { BaseTenantEntity } from '../../database/base-tenant.entity';

/** Místo/zóna s řízeným vstupem (ADR-0006). Nárok dodává modul (ticket/membership). */
@Entity('access_points')
export class AccessPoint extends BaseTenantEntity {
  @Column({ type: 'uuid', name: 'location_id', nullable: true })
  locationId!: string | null;

  @Column({ type: 'text' })
  name!: string;

  /** Logická zóna (např. "vip", "gate", "sklad-A"). */
  @Column({ type: 'text', name: 'zone_key' })
  zoneKey!: string;

  @Column({ type: 'text', default: 'in' })
  direction!: 'in' | 'out' | 'both';

  @Column({ type: 'jsonb', name: 'settings_json', default: {} })
  settings!: Record<string, unknown>;
}
