import { Column, Entity, Index } from 'typeorm';
import type { ModuleType } from '@tagery/shared';
import { BaseTenantEntity } from '../../database/base-tenant.entity';

/** Centrální entita: co nosič představuje + jaký modul obsluhuje (ADR-0002). */
@Entity('digital_objects')
@Index(['tenantId', 'slug'], { unique: true })
export class DigitalObject extends BaseTenantEntity {
  @Column({ type: 'text', name: 'module_type' })
  moduleType!: ModuleType;

  @Column({ type: 'text' })
  slug!: string;

  @Column({ type: 'text', default: 'active' })
  status!: 'active' | 'inactive' | 'archived';

  @Column({ type: 'text', name: 'primary_url', nullable: true })
  primaryUrl!: string | null;

  @Column({ type: 'jsonb', default: {} })
  metadata!: Record<string, unknown>;

  @Column({ type: 'timestamptz', name: 'valid_from', nullable: true })
  validFrom!: Date | null;

  @Column({ type: 'timestamptz', name: 'valid_to', nullable: true })
  validTo!: Date | null;
}
