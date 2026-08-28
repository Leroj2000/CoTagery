import { Column, Entity, Index } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';

/** Jeden parametr specifikace (např. „Výkon" → „650 W"). */
export interface SpecItem {
  label: string;
  value: string;
}

/**
 * Technické specifikace položky získané „přes AI" (dohledané z webu). Jeden set na
 * položku (unique asset_id). `specs` = pole {label,value}; `null` dokud se stahuje.
 */
@Entity('asset_specs')
export class AssetSpec extends BaseTenantEntity {
  @Index()
  @Column({ type: 'uuid', name: 'asset_id' })
  assetId!: string;

  @Column({ type: 'jsonb', nullable: true })
  specs!: SpecItem[] | null;

  @Column({ type: 'text', name: 'source_url', nullable: true })
  sourceUrl!: string | null;

  @Column({ type: 'text', default: 'fetching' })
  status!: 'fetching' | 'ready' | 'failed';

  @Column({ type: 'text', name: 'failure_reason', nullable: true })
  failureReason!: string | null;
}
