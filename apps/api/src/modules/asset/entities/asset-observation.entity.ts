import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { ScanDto } from '../dto/scan.dto';

/**
 * Pozorování věci (Last Observation) – „kde/kdy byla naposledy VIDĚNA
 * (naskenována)". Samostatná, append-only vrstva (bez updated_at), NEMÍCHAT
 * s evidencí (current_holder). Zapisuje se při Global Scanu a inventuře.
 */
@Entity('asset_observations')
@Index(['assetId', 'observedAt'])
export class AssetObservation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Column({ type: 'uuid', name: 'asset_id' })
  assetId!: string;

  /** Odkud pozorování pochází. */
  @Column({ type: 'text', default: 'scan' })
  source!: 'scan' | 'inventory';

  /** Místo pozorování, pokud je známé (inventura místa); u global scanu null. */
  @Column({ type: 'uuid', name: 'location_id', nullable: true })
  locationId!: string | null;

  /** Uživatel, který věc naskenoval. */
  @Column({ type: 'uuid', name: 'actor_user_id', nullable: true })
  actorUserId!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ type: 'jsonb', name: 'capture_context', nullable: true })
  captureContext!: Omit<ScanDto, 'code'> | null;

  @Column({ type: 'timestamptz', name: 'observed_at' })
  observedAt!: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
