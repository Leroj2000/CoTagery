import { Column, Entity, Index } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';

/**
 * Servisní záznam věci (§17): servis, revize, kalibrace, oprava. `next_due_at`
 * slouží pro upozornění na blížící se servis.
 */
@Entity('asset_services')
export class ServiceRecord extends BaseTenantEntity {
  @Index()
  @Column({ type: 'uuid', name: 'asset_id' })
  assetId!: string;

  @Column({ type: 'text' })
  kind!: 'service' | 'inspection' | 'calibration' | 'repair';

  @Column({ type: 'timestamptz', name: 'performed_at', nullable: true })
  performedAt!: Date | null;

  /** Příští termín (revize/kalibrace/STK) – pro upozornění. */
  @Column({ type: 'timestamptz', name: 'next_due_at', nullable: true })
  nextDueAt!: Date | null;

  @Column({ type: 'text', nullable: true })
  provider!: string | null;

  @Column({ type: 'numeric', nullable: true })
  cost!: string | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;
}
