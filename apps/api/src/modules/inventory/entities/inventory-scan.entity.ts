import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { ScanResult } from '../inventory.logic';

/** Jeden sken během inventury (append-only). Unikát (check, asset) proti dvojímu skenu. */
@Entity('inventory_scans')
@Index(['checkId', 'assetId'], { unique: true })
export class InventoryScan {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId!: string;

  @Index()
  @Column({ type: 'uuid', name: 'check_id' })
  checkId!: string;

  @Column({ type: 'uuid', name: 'asset_id' })
  assetId!: string;

  @Column({ type: 'text' })
  result!: ScanResult;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
