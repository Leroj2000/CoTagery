import { Column, Entity } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';
import type { VehicleInventoryRow } from '../vehicle-inventory.logic';

/**
 * Inventura. `stock` = nad místem/osobou/kontejnerem: při startu se zmrazí
 * množina očekávaných assetů (`expected_asset_ids`), aby výsledek nebyl
 * ovlivněný pohyby během inventury. `vehicle` = sepsání stavu vozidel
 * (`expected_asset_ids`) k období `period_from`–`period_to`.
 */
@Entity('inventory_checks')
export class InventoryCheck extends BaseTenantEntity {
  @Column({ type: 'text', default: 'stock' })
  kind!: 'stock' | 'vehicle';

  /** Období inventury vozidel (YYYY-MM-DD, včetně). */
  @Column({ type: 'date', name: 'period_from', nullable: true })
  periodFrom!: string | null;

  @Column({ type: 'date', name: 'period_to', nullable: true })
  periodTo!: string | null;

  /** Poznámky k vozidlům (assetId → text). */
  @Column({ type: 'jsonb', name: 'vehicle_notes', default: {} })
  vehicleNotes!: Record<string, string>;

  /** Stav vozidel zmrazený při uzavření; u probíhající se počítá živě. */
  @Column({ type: 'jsonb', name: 'vehicle_rows', nullable: true })
  vehicleRows!: VehicleInventoryRow[] | null;

  /** Nad čím inventura probíhá: místo / osoba / kontejner. */
  @Column({ type: 'text', name: 'subject_type', default: 'location' })
  subjectType!: 'location' | 'person' | 'asset';

  @Column({ type: 'uuid', name: 'subject_id', nullable: true })
  subjectId!: string | null;

  /** Zpětná kompatibilita – u inventur nad lokací. */
  @Column({ type: 'uuid', name: 'location_id', nullable: true })
  locationId!: string | null;

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
