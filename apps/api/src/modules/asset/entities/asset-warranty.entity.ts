import { Column, Entity, Index } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';
import type { WarrantyStartBasis } from '../purchase.logic';

/**
 * Záruka položky (víc na položku – výrobce, prodejce, prodloužená, baterie…).
 * Začátek je odvozený z pořízení (`startBasis`) nebo ruční; konec je zadaný
 * nebo začátek + měsíce.
 */
@Entity('asset_warranties')
export class AssetWarranty extends BaseTenantEntity {
  @Index()
  @Column({ type: 'uuid', name: 'asset_id' })
  assetId!: string;

  @Column({ type: 'text' })
  title!: string;

  /** Od čeho běží: datum pořízení / uvedení do provozu / ručně zadané datum. */
  @Column({ type: 'text', name: 'start_basis', default: 'custom' })
  startBasis!: WarrantyStartBasis;

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
