import { Column, Entity, Index } from 'typeorm';
import type { TireAxle, TireConstruction, TireSeason } from '@tagery/shared';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';

const numeric = {
  to: (v: number | null | undefined) => v,
  from: (v: string | null) => (v == null ? null : Number(v)),
};

/** Pneumatiky jedné nápravy v sadě (viz migrace AssetTires). */
@Entity('asset_tires')
@Index(['tenantId', 'assetId'])
export class AssetTire extends BaseTenantEntity {
  @Column({ type: 'uuid', name: 'asset_id' })
  assetId!: string;

  @Column({ type: 'text', name: 'set_label' })
  setLabel!: string;

  @Column({ type: 'text' })
  season!: TireSeason;

  @Column({ type: 'text', default: 'all' })
  axle!: TireAxle;

  @Column({ type: 'integer' })
  width!: number;

  @Column({ type: 'integer', name: 'aspect_ratio', nullable: true })
  aspectRatio!: number | null;

  @Column({ type: 'numeric', name: 'rim_diameter', precision: 5, scale: 1, transformer: numeric })
  rimDiameter!: number;

  @Column({ type: 'text', default: 'R' })
  construction!: TireConstruction;

  @Column({ type: 'text', name: 'load_index', nullable: true })
  loadIndex!: string | null;

  @Column({ type: 'text', name: 'speed_index', nullable: true })
  speedIndex!: string | null;

  @Column({ type: 'text', nullable: true })
  brand!: string | null;

  @Column({ type: 'text', nullable: true })
  dot!: string | null;

  @Column({
    type: 'numeric',
    name: 'tread_depth_mm',
    precision: 4,
    scale: 1,
    nullable: true,
    transformer: numeric,
  })
  treadDepthMm!: number | null;

  @Column({ type: 'integer', default: 4 })
  quantity!: number;

  @Column({ type: 'boolean', default: false })
  mounted!: boolean;

  @Column({ type: 'uuid', name: 'stored_location_id', nullable: true })
  storedLocationId!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;
}
