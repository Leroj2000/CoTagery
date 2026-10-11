import { Column, Entity, Index } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';
import { moneyTransformer } from './money.transformer';

/**
 * Pořízení položky (1:1). Ukládají se obě ceny i sazba – žádný zpětný přepočet,
 * aby historii nerozbila změna sazby nebo zaokrouhlení. `vatPayer` = snapshot,
 * zda byla firma v době zadání plátce DPH. Čte jen `asset.purchase.view`.
 */
@Entity('asset_purchases')
@Index(['tenantId', 'assetId'], { unique: true })
export class AssetPurchase extends BaseTenantEntity {
  @Column({ type: 'uuid', name: 'asset_id' })
  assetId!: string;

  /** Datum pořízení (YYYY-MM-DD) – nezávislé na založení položky v systému. */
  @Column({ type: 'date', name: 'purchased_on', nullable: true })
  purchasedOn!: string | null;

  @Column({ type: 'text', nullable: true })
  supplier!: string | null;

  /** Číslo faktury / dokladu. */
  @Column({ type: 'text', name: 'document_number', nullable: true })
  documentNumber!: string | null;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    name: 'price_net',
    nullable: true,
    transformer: moneyTransformer,
  })
  priceNet!: number | null;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    name: 'vat_rate',
    nullable: true,
    transformer: moneyTransformer,
  })
  vatRate!: number | null;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    name: 'price_gross',
    nullable: true,
    transformer: moneyTransformer,
  })
  priceGross!: number | null;

  @Column({ type: 'text', default: 'CZK' })
  currency!: string;

  @Column({ type: 'boolean', name: 'vat_payer', default: false })
  vatPayer!: boolean;

  @Column({ type: 'text', nullable: true })
  note!: string | null;
}
