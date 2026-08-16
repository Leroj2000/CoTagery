import { Column, Entity } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';

/** Půjčka (tenant-scoped, RLS). Odkazuje na platformový RenterProfile. */
@Entity('rental_loans')
export class Loan extends BaseTenantEntity {
  @Column({ type: 'uuid', name: 'item_id' })
  itemId!: string;

  @Column({ type: 'uuid', name: 'renter_profile_id' })
  renterProfileId!: string;

  @Column({ type: 'timestamptz', name: 'rental_start', nullable: true })
  rentalStart!: Date | null;

  @Column({ type: 'timestamptz', name: 'rental_end', nullable: true })
  rentalEnd!: Date | null;

  @Column({ type: 'text', default: 'active' })
  status!: 'pending_verification' | 'active' | 'returned' | 'cancelled';

  /** Kdy byla věc vrácena (audit). Null = dosud nevrácena. */
  @Column({ type: 'timestamptz', name: 'returned_at', nullable: true })
  returnedAt!: Date | null;
}
