import { Column, Entity } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';

/**
 * Úroveň členství (tier) – EPIC-16. Nese cenu, délku platnosti předplatného,
 * seznam zón, do kterých tier opravňuje (napojení na Access-Control EPIC-15),
 * a konfigurovatelnou grace periodu pro dunning (EPIC-17).
 */
@Entity('membership_tiers')
export class MembershipTier extends BaseTenantEntity {
  @Column({ type: 'text' })
  name!: string;

  /** Číselná úroveň (vyšší = vyšší tier). Pro porovnání nároků. */
  @Column({ type: 'int', default: 0 })
  level!: number;

  /** Cena za období předplatného (string kvůli numeric přesnosti). */
  @Column({ type: 'numeric', default: 0 })
  price!: string;

  @Column({ type: 'text', default: 'CZK' })
  currency!: string;

  /** Délka jednoho období členství ve dnech (předplatné). */
  @Column({ type: 'int', name: 'validity_days', default: 365 })
  validityDays!: number;

  /** Kolik dní po expiraci ještě tolerovat (grace při failed payment). */
  @Column({ type: 'int', name: 'grace_days', default: 7 })
  graceDays!: number;

  /** Logické zóny (zone_key), do kterých tier opravňuje. */
  @Column({ type: 'jsonb', name: 'zone_keys', default: [] })
  zoneKeys!: string[];
}
