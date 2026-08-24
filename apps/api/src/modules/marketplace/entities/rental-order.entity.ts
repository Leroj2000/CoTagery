import { Column, Entity, Index } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';

/**
 * Stavový automat objednávky (EPIC-19 §5). `awaiting_payment`+ blokují dostupnost
 * věci (EXCLUDE constraint proti dvojité rezervaci). F2 vytváří objednávku rovnou
 * v `awaiting_payment` (nájemce přihlášen, období ověřeno, cena spočtena);
 * potvrzení platby (`paid`) a předání/vrácení řeší F3.
 */
export type OrderStatus =
  | 'pending'
  | 'awaiting_payment'
  | 'paid'
  | 'confirmed'
  | 'picked_up'
  | 'returned'
  | 'completed'
  | 'cancelled'
  | 'expired';

/** Stavy, které drží věc rezervovanou (blokují překryv v EXCLUDE constraintu). */
export const BLOCKING_ORDER_STATUSES: OrderStatus[] = [
  'awaiting_payment',
  'paid',
  'confirmed',
  'picked_up',
];

/**
 * Objednávka veřejné půjčovny (EPIC-19 F2). Tenant-scoped na FIRMU (majitele
 * inzerátu) → majitel ji spravuje pod běžnou RLS. Nájemce ji zakládá i čte přes
 * SECURITY DEFINER funkce (nemá tenant kontext firmy). `renter_user_id` = povinná
 * platformová identita (rozh. C). Peníze jako numeric→string.
 */
@Entity('rental_order')
export class RentalOrder extends BaseTenantEntity {
  @Index()
  @Column({ type: 'uuid', name: 'listing_id' })
  listingId!: string;

  @Index()
  @Column({ type: 'uuid', name: 'asset_id' })
  assetId!: string;

  @Index()
  @Column({ type: 'uuid', name: 'renter_user_id' })
  renterUserId!: string;

  @Column({ type: 'uuid', name: 'renter_profile_id', nullable: true })
  renterProfileId!: string | null;

  @Column({ type: 'timestamptz', name: 'starts_at' })
  startsAt!: Date;

  @Column({ type: 'timestamptz', name: 'ends_at' })
  endsAt!: Date;

  @Column({ type: 'integer' })
  days!: number;

  @Column({ type: 'text', default: 'awaiting_payment' })
  status!: OrderStatus;

  @Column({ type: 'numeric', name: 'rent_amount', default: 0 })
  rentAmount!: string;

  @Column({ type: 'numeric', name: 'deposit_amount', default: 0 })
  depositAmount!: string;

  @Column({ type: 'numeric', default: 0 })
  total!: string;

  @Column({ type: 'text', default: 'CZK' })
  currency!: string;

  @Column({ type: 'text', name: 'payment_method', nullable: true })
  paymentMethod!: string | null;

  @Column({ type: 'text', name: 'payment_ref', nullable: true })
  paymentRef!: string | null;

  @Column({ type: 'text', name: 'deposit_ref', nullable: true })
  depositRef!: string | null;

  @Column({ type: 'text', name: 'renter_note', nullable: true })
  renterNote!: string | null;

  /** Variabilní symbol platby (sekvence) – do SPAYD/QR. */
  @Column({ type: 'bigint', name: 'payment_vs' })
  paymentVs!: string;

  /** Person v tenantu majitele = držitel věci po vyzvednutí (custody loan). */
  @Column({ type: 'uuid', name: 'renter_person_id', nullable: true })
  renterPersonId!: string | null;

  /** Kolik z kauce bylo při vrácení vráceno nájemci (zbytek = sražená škoda). */
  @Column({ type: 'numeric', name: 'deposit_returned', nullable: true })
  depositReturned!: string | null;

  @Column({ type: 'timestamptz', name: 'paid_at', nullable: true })
  paidAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'picked_up_at', nullable: true })
  pickedUpAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'returned_at', nullable: true })
  returnedAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'completed_at', nullable: true })
  completedAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'cancelled_at', nullable: true })
  cancelledAt!: Date | null;

  @Column({ type: 'timestamptz', name: 'settled_at', nullable: true })
  settledAt!: Date | null;
}
