import { Column, Entity, Index } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete';

/**
 * Předplatné (EPIC-17). Zdroj pravdy o stavu jsou PSP webhooky; my zrcadlíme.
 * `membership_id` váže předplatné na členství, které prodlužuje/expiruje.
 */
@Entity('subscriptions')
export class Subscription extends BaseTenantEntity {
  @Column({ type: 'uuid', name: 'billing_customer_id' })
  billingCustomerId!: string;

  @Column({ type: 'uuid', name: 'membership_id', nullable: true })
  membershipId!: string | null;

  @Column({ type: 'uuid', name: 'tier_id' })
  tierId!: string;

  @Column({ type: 'text', default: 'incomplete' })
  status!: SubscriptionStatus;

  @Index({ unique: true })
  @Column({ type: 'text', name: 'psp_subscription_ref' })
  pspSubscriptionRef!: string;

  @Column({ type: 'timestamptz', name: 'current_period_end', nullable: true })
  currentPeriodEnd!: Date | null;

  @Column({ type: 'boolean', name: 'cancel_at_period_end', default: false })
  cancelAtPeriodEnd!: boolean;

  /** Kdy vyprší grace při past_due (dunning) – po něm expirace členství. */
  @Column({ type: 'timestamptz', name: 'grace_until', nullable: true })
  graceUntil!: Date | null;
}
