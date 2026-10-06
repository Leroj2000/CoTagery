import { Column, Entity, Index } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';

@Entity('asset_maintenance_rules')
@Index(['tenantId', 'assetId', 'code'], { unique: true })
export class MaintenanceRule extends BaseTenantEntity {
  @Column({ type: 'uuid', name: 'asset_id' })
  assetId!: string;

  @Column({ type: 'text' })
  code!: string;

  @Column({ type: 'integer', name: 'interval_units' })
  intervalUnits!: number;

  @Column({ type: 'integer', name: 'interval_months', nullable: true })
  intervalMonths!: number | null;

  @Column({ type: 'text' })
  description!: string;
}
