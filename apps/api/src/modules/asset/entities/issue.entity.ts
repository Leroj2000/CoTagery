import { Column, Entity, Index } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';

/**
 * Nahlášený problém / poškození věci (§ Servis, „Nahlásit problém"). Condition
 * je oddělený od custody stavu (věc může být půjčená i poškozená zároveň).
 */
@Entity('asset_issues')
export class Issue extends BaseTenantEntity {
  @Index()
  @Column({ type: 'uuid', name: 'asset_id' })
  assetId!: string;

  @Column({ type: 'uuid', name: 'reported_by_id', nullable: true })
  reportedById!: string | null;

  @Column({ type: 'text' })
  kind!: 'damage' | 'malfunction' | 'missing_part' | 'other';

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'text', default: 'open' })
  status!: 'open' | 'resolved';

  @Column({ type: 'timestamptz', name: 'resolved_at', nullable: true })
  resolvedAt!: Date | null;
}
