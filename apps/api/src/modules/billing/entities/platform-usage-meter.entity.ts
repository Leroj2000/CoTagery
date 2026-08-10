import { Column, Entity, Index } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';

/**
 * Metering platformového využití (Tok 2, EPIC-17): počet vydaných karet per
 * tenant za období, který se reportuje do Stripe jako usage-based SaaS fee.
 */
@Entity('platform_usage_meters')
@Index(['tenantId', 'period', 'metric'], { unique: true })
export class PlatformUsageMeter extends BaseTenantEntity {
  /** Účtovací období ve formátu YYYY-MM. */
  @Column({ type: 'text' })
  period!: string;

  @Column({ type: 'text' })
  metric!: string;

  @Column({ type: 'int', default: 0 })
  quantity!: number;

  /** Kdy bylo nareportováno do PSP (null = zatím ne). */
  @Column({ type: 'timestamptz', name: 'reported_at', nullable: true })
  reportedAt!: Date | null;
}
