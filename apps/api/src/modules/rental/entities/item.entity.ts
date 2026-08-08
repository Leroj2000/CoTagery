import { Column, Entity } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';

/** Půjčovaná věc (tenant-scoped, RLS). */
@Entity('rental_items')
export class Item extends BaseTenantEntity {
  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', name: 'serial_number', nullable: true })
  serialNumber!: string | null;

  @Column({ type: 'numeric', name: 'price_per_day', default: 0 })
  pricePerDay!: string;

  @Column({ type: 'numeric', default: 0 })
  deposit!: string;

  /** Minimální úroveň ověření nájemce nutná k půjčení (ADR-0005). */
  @Column({ type: 'text', name: 'required_verification_level', default: 'contact' })
  requiredVerificationLevel!: 'none' | 'contact' | 'document' | 'full_kyc';
}
