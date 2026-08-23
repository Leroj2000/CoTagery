import { Column, Entity, Index } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';

export type ListingStatus = 'draft' | 'published' | 'paused' | 'archived';

/**
 * Veřejný inzerát půjčovny (EPIC-19 F1). Publikuje Věc (asset) k zapůjčení s
 * ceníkem. Ceník je na inzerátu, ne na věci. `status='published'` = viditelné
 * ve veřejném katalogu (přes SECURITY DEFINER funkce). Peníze jako numeric→string.
 */
@Entity('rental_listing')
export class RentalListing extends BaseTenantEntity {
  @Index()
  @Column({ type: 'uuid', name: 'asset_id' })
  assetId!: string;

  @Column({ type: 'text', default: 'draft' })
  status!: ListingStatus;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'text', nullable: true })
  terms!: string | null;

  @Column({ type: 'uuid', name: 'pickup_location_id', nullable: true })
  pickupLocationId!: string | null;

  @Column({ type: 'text', default: 'CZK' })
  currency!: string;

  @Column({ type: 'numeric', name: 'price_per_day', default: 0 })
  pricePerDay!: string;

  @Column({ type: 'numeric', name: 'price_per_hour', nullable: true })
  pricePerHour!: string | null;

  @Column({ type: 'numeric', name: 'price_per_week', nullable: true })
  pricePerWeek!: string | null;

  @Column({ type: 'numeric', name: 'deposit_amount', default: 0 })
  depositAmount!: string;

  @Column({ type: 'integer', name: 'min_days', default: 1 })
  minDays!: number;

  @Column({ type: 'integer', name: 'max_days', nullable: true })
  maxDays!: number | null;

  @Column({ type: 'text' })
  slug!: string;

  @Column({ type: 'timestamptz', name: 'published_at', nullable: true })
  publishedAt!: Date | null;
}
