import { Column, Entity } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';

/**
 * Inventura nad lokací. Při startu se zmrazí množina očekávaných assetů
 * (`expected_asset_ids`), aby výsledek nebyl ovlivněný pohyby během inventury.
 */
@Entity('inventory_checks')
export class InventoryCheck extends BaseTenantEntity {
  @Column({ type: 'uuid', name: 'location_id' })
  locationId!: string;

  @Column({ type: 'text', default: 'open' })
  status!: 'open' | 'closed';

  /** Zmrazená množina očekávaných assetů (v lokaci při startu). */
  @Column({ type: 'jsonb', name: 'expected_asset_ids', default: [] })
  expectedAssetIds!: string[];

  @Column({ type: 'int', name: 'found_count', default: 0 })
  foundCount!: number;

  @Column({ type: 'int', name: 'missing_count', default: 0 })
  missingCount!: number;

  @Column({ type: 'int', name: 'unexpected_count', default: 0 })
  unexpectedCount!: number;

  @Column({ type: 'timestamptz', name: 'closed_at', nullable: true })
  closedAt!: Date | null;
}
