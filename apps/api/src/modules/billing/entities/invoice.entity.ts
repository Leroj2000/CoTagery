import { Column, Entity, Index } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';

/**
 * Faktura (EPIC-17) zrcadlená z PSP. PDF vzniká u PSP; my držíme rozpad částky
 * a DPH pro CZ náležitosti + reverse charge EU B2B. V stubu generujeme lokálně.
 */
@Entity('invoices')
export class Invoice extends BaseTenantEntity {
  @Index()
  @Column({ type: 'uuid', name: 'subscription_id' })
  subscriptionId!: string;

  @Index({ unique: true })
  @Column({ type: 'text', name: 'psp_invoice_ref' })
  pspInvoiceRef!: string;

  /** Částka bez DPH. */
  @Column({ type: 'numeric', name: 'amount_net', default: 0 })
  amountNet!: string;

  @Column({ type: 'numeric', name: 'vat_amount', default: 0 })
  vatAmount!: string;

  @Column({ type: 'numeric', name: 'vat_rate', default: 21 })
  vatRate!: string;

  @Column({ type: 'boolean', name: 'reverse_charge', default: false })
  reverseCharge!: boolean;

  @Column({ type: 'text', default: 'CZK' })
  currency!: string;

  @Column({ type: 'text', default: 'open' })
  status!: 'open' | 'paid' | 'void' | 'uncollectible';

  @Column({ type: 'timestamptz', name: 'period_start', nullable: true })
  periodStart!: Date | null;

  @Column({ type: 'timestamptz', name: 'period_end', nullable: true })
  periodEnd!: Date | null;
}
