import { Column, Entity, Index } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';

/**
 * Zákazník v billingu (EPIC-17). Zrcadlí zákazníka u PSP (Stripe). Žádná data
 * karet u nás – jen reference/tokeny (PCI). V stubu je `psp_customer_ref` fake.
 */
@Entity('billing_customers')
export class BillingCustomer extends BaseTenantEntity {
  @Column({ type: 'uuid', name: 'member_id', nullable: true })
  memberId!: string | null;

  @Index({ unique: true })
  @Column({ type: 'text', name: 'psp_customer_ref' })
  pspCustomerRef!: string;

  @Column({ type: 'text', nullable: true })
  email!: string | null;
}
