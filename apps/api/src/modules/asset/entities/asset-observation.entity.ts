import { Column, Entity, Index } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';

/**
 * Pozorování věci (Last Observation) – „kde/kdy byla naposledy VIDĚNA
 * (naskenována)". Samostatná vrstva, NEMÍCHAT s evidencí (current_holder).
 * Zapisuje se při Global Scanu a inventuře; nemění stav věci.
 */
@Entity('asset_observations')
@Index(['assetId', 'observedAt'])
export class AssetObservation extends BaseTenantEntity {
  @Column({ type: 'uuid', name: 'asset_id' })
  assetId!: string;

  /** Odkud pozorování pochází. */
  @Column({ type: 'text', default: 'scan' })
  source!: 'scan' | 'inventory';

  /** Místo pozorování, pokud je známé (inventura místa); u global scanu null. */
  @Column({ type: 'uuid', name: 'location_id', nullable: true })
  locationId!: string | null;

  /** Uživatel, který věc naskenoval. */
  @Column({ type: 'uuid', name: 'actor_user_id', nullable: true })
  actorUserId!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ type: 'timestamptz', name: 'observed_at' })
  observedAt!: Date;
}
