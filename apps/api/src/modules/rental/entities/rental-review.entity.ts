import { Column, Entity } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';

/**
 * Oboustranné hodnocení půjčky (tenant-scoped zápis; agregát se propisuje na
 * platformový RenterProfile – ADR-0005).
 */
@Entity('rental_reviews')
export class RentalReview extends BaseTenantEntity {
  @Column({ type: 'uuid', name: 'loan_id' })
  loanId!: string;

  @Column({ type: 'text' })
  direction!: 'lessor_to_renter' | 'renter_to_lessor';

  @Column({ type: 'uuid', name: 'renter_profile_id' })
  renterProfileId!: string;

  @Column({ type: 'int' })
  rating!: number;

  @Column({ type: 'text', nullable: true })
  comment!: string | null;
}
