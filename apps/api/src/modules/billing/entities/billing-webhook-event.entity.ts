import { Column, Entity, Index } from 'typeorm';
import { BaseTenantEntity } from '../../../core/database/base-tenant.entity';

/**
 * Přijatá PSP webhook událost (EPIC-17). `psp_event_ref` je unikátní pro
 * idempotenci – duplicitní doručení stav nezmění dvakrát.
 */
@Entity('billing_webhook_events')
export class BillingWebhookEvent extends BaseTenantEntity {
  @Index({ unique: true })
  @Column({ type: 'text', name: 'psp_event_ref' })
  pspEventRef!: string;

  @Column({ type: 'text', name: 'event_type' })
  eventType!: string;

  @Column({ type: 'jsonb', default: {} })
  payload!: Record<string, unknown>;

  @Column({ type: 'timestamptz', name: 'processed_at', nullable: true })
  processedAt!: Date | null;
}
