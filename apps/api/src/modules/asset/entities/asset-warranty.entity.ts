import { Column, Entity, Index } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';

/**
 * Záruka položky (víc na položku – výrobce, prodloužená, baterie…). Začátek
 * se předvyplní datem pořízení; konec je zadaný nebo začátek + měsíce.
 */
@Entity('asset_warranties')
export class AssetWarranty extends BaseTenantEntity {
  @Index()
  @Column({ type: 'uuid', name: 'asset_id' })
  assetId!: string;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'date', name: 'starts_on', nullable: true })
  startsOn!: string | null;

  @Column({ type: 'integer', nullable: true })
  months!: number | null;

  @Column({ type: 'date', name: 'ends_on' })
  endsOn!: string;

  /** Kdo záruku poskytuje / kde se reklamuje. */
  @Column({ type: 'text', nullable: true })
  provider!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  /** Záruční list (asset_documents). */
  @Column({ type: 'uuid', name: 'document_id', nullable: true })
  documentId!: string | null;
}
