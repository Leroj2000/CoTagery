import { Column, Entity, Index } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';

export type MembershipStatus = 'active' | 'expired' | 'suspended' | 'cancelled';

/**
 * Konkrétní členství člena v tieru (EPIC-16). Platnost od/do řídí buď ruční
 * vydání, nebo předplatné (EPIC-17) – to prodlužuje `valid_to`. Status je
 * uložený stav; efektivní platnost počítá `computeEffectiveStatus`.
 */
@Entity('memberships')
export class Membership extends BaseTenantEntity {
  @Index()
  @Column({ type: 'uuid', name: 'member_id' })
  memberId!: string;

  @Column({ type: 'uuid', name: 'tier_id' })
  tierId!: string;

  @Column({ type: 'text', default: 'active' })
  status!: MembershipStatus;

  @Column({ type: 'timestamptz', name: 'valid_from' })
  validFrom!: Date;

  @Column({ type: 'timestamptz', name: 'valid_to' })
  validTo!: Date;

  @Column({ type: 'boolean', name: 'auto_renew', default: false })
  autoRenew!: boolean;

  /** Reference na předplatné (EPIC-17), pokud je členství placené. */
  @Column({ type: 'uuid', name: 'subscription_id', nullable: true })
  subscriptionId!: string | null;
}
