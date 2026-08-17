import { Column, Entity } from 'typeorm';
import { BaseTenantEntity } from '../../database/base-tenant.entity';

/**
 * Odběr doménových událostí (webhook). Tenant si zaregistruje URL a dostane
 * podepsané POSTy na vybrané události (movement.created, inventory.mismatch…).
 * Prázdné `events` = odběr všech událostí.
 */
@Entity('webhook_endpoints')
export class WebhookEndpoint extends BaseTenantEntity {
  @Column({ type: 'text' })
  url!: string;

  /** Sdílené tajemství pro HMAC podpis payloadu. */
  @Column({ type: 'text' })
  secret!: string;

  @Column({ type: 'jsonb', default: [] })
  events!: string[];

  @Column({ type: 'boolean', default: true })
  active!: boolean;
}
