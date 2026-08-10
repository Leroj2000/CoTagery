import { Column, Entity, Index } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';

export type BenefitKind = 'discount_percent' | 'special_price' | 'free' | 'zone_access';

/**
 * Nárok (benefit) tieru – EPIC-16. Tenká entitlement vrstva: Membership benefit
 * jen popisuje, Payment ho realizuje při účtování. `value` drží parametr
 * (procento slevy / speciální cena), `targetKey` cílí na produkt/službu/zónu.
 */
@Entity('membership_benefits')
export class MembershipBenefit extends BaseTenantEntity {
  @Index()
  @Column({ type: 'uuid', name: 'tier_id' })
  tierId!: string;

  @Column({ type: 'text' })
  kind!: BenefitKind;

  /** Na co benefit cílí (SKU, kategorie, zone_key). Null = plošně. */
  @Column({ type: 'text', name: 'target_key', nullable: true })
  targetKey!: string | null;

  /** Parametr benefitu (procento / částka). String kvůli numeric. */
  @Column({ type: 'numeric', nullable: true })
  value!: string | null;

  @Column({ type: 'text', nullable: true })
  description!: string | null;
}
