import { Column, Entity, Index } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';

/**
 * Rezervace / požadavek na věc (§15): kdo, kdy od–do, na co. Skladník schválí
 * nebo zamítne. MVP netvrdě neblokuje, jen eviduje záměr.
 */
@Entity('reservations')
export class Reservation extends BaseTenantEntity {
  @Index()
  @Column({ type: 'uuid', name: 'asset_id' })
  assetId!: string;

  /** Kdo o věc žádá (osoba – Party). */
  @Column({ type: 'uuid', name: 'requested_by_id', nullable: true })
  requestedById!: string | null;

  @Column({ type: 'timestamptz', name: 'from_at', nullable: true })
  fromAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'to_at', nullable: true })
  toAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  purpose!: string | null;

  @Column({ type: 'text', default: 'pending' })
  status!: 'pending' | 'approved' | 'rejected' | 'cancelled';
}
