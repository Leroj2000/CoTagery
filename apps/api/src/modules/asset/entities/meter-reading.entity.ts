import { Column, Entity, Index } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';
import { meterNumberTransformer } from './meter-number.transformer';

@Entity('asset_meter_readings')
export class MeterReading extends BaseTenantEntity {
  @Index()
  @Column({ type: 'uuid', name: 'asset_id' })
  assetId!: string;

  @Column({ type: 'numeric', precision: 12, scale: 1, transformer: meterNumberTransformer })
  value!: number;

  @Column({ type: 'timestamptz', name: 'observed_at' })
  observedAt!: Date;

  @Column({ type: 'timestamptz', name: 'deleted_at', nullable: true })
  deletedAt!: Date | null;
}
