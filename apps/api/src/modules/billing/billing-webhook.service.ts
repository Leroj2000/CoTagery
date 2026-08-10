import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { TenantContextService } from '../../core/tenancy/tenant-context.service';
import { MembershipService } from '../membership/membership.service';
import { extendValidTo } from '../membership/membership.logic';
import { BillingService } from './billing.service';
import { Subscription } from './entities/subscription.entity';
import { BillingWebhookEvent } from './entities/billing-webhook-event.entity';
import { verifyWebhookSignature } from './billing.logic';

interface WebhookEnvelope {
  id: string;
  type: string;
  data: { pspSubscriptionRef?: string; reverseCharge?: boolean };
}

interface SubscriptionLookupRow {
  subscription_id: string;
  tenant_id: string;
}

export interface WebhookResult {
  received: true;
  status: 'processed' | 'duplicate';
}

/**
 * Zpracování PSP webhooků (EPIC-17). Ověří podpis, najde tenanta přes SECURITY
 * DEFINER lookup (běží bez JWT), pak v tenant kontextu idempotentně zrcadlí
 * stav a řídí životní cyklus členství. Zdroj pravdy o platbě = tyto události.
 */
@Injectable()
export class BillingWebhookService {
  private readonly logger = new Logger(BillingWebhookService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly context: TenantContextService,
    private readonly memberships: MembershipService,
    private readonly billing: BillingService,
    private readonly config: ConfigService,
  ) {}

  async handle(rawBody: string, signature: string): Promise<WebhookResult> {
    const secret = this.config.get<string>('BILLING_WEBHOOK_SECRET') ?? 'whsec_stub';
    if (!verifyWebhookSignature(rawBody, signature, secret)) {
      throw new UnauthorizedException('Neplatný podpis webhooku');
    }

    let event: WebhookEnvelope;
    try {
      event = JSON.parse(rawBody) as WebhookEnvelope;
    } catch {
      throw new BadRequestException('Neplatné JSON tělo');
    }
    const pspRef = event.data?.pspSubscriptionRef;
    if (!event.id || !event.type || !pspRef) {
      throw new BadRequestException('Chybí id/type/pspSubscriptionRef');
    }

    // Tenant + subscription přes SECURITY DEFINER (webhook nemá JWT kontext).
    const rows: SubscriptionLookupRow[] = await this.dataSource.query(
      'SELECT * FROM billing_subscription_lookup($1)',
      [pspRef],
    );
    if (rows.length === 0) throw new NotFoundException('Neznámé předplatné');
    const { tenant_id: tenantId, subscription_id: subscriptionId } = rows[0];

    return this.context.runInTenant(tenantId, async () => {
      const eventRepo = this.context.manager.getRepository(BillingWebhookEvent);

      // Idempotence: duplicitní psp_event_ref stav nezmění.
      const existing = await eventRepo.findOne({ where: { pspEventRef: event.id } });
      if (existing?.processedAt) {
        return { received: true, status: 'duplicate' };
      }
      const record =
        existing ??
        (await eventRepo.save(
          eventRepo.create({
            tenantId,
            pspEventRef: event.id,
            eventType: event.type,
            payload: event as unknown as Record<string, unknown>,
          }),
        ));

      await this.applyEvent(subscriptionId, event);

      record.processedAt = new Date();
      await eventRepo.save(record);
      return { received: true, status: 'processed' };
    });
  }

  private async applyEvent(subscriptionId: string, event: WebhookEnvelope): Promise<void> {
    const sub = await this.billing.getSubscription(subscriptionId);

    switch (event.type) {
      case 'invoice.paid': {
        sub.status = 'active';
        sub.graceUntil = null;
        if (sub.membershipId) {
          const m = await this.memberships.renew(sub.membershipId);
          sub.currentPeriodEnd = m.validTo;
        }
        await this.context.manager.getRepository(Subscription).save(sub);
        await this.billing.recordPaidInvoice(sub, event.data.reverseCharge ?? false);
        break;
      }
      case 'invoice.payment_failed': {
        sub.status = 'past_due';
        // Grace: členství zůstává aktivní do validTo + graceDays (dunning).
        const tier = await this.memberships.getTier(sub.tierId);
        const base = sub.currentPeriodEnd ?? new Date();
        sub.graceUntil = extendValidTo(base, tier.graceDays, base);
        await this.context.manager.getRepository(Subscription).save(sub);
        break;
      }
      case 'customer.subscription.deleted': {
        sub.status = 'canceled';
        if (sub.membershipId) {
          await this.memberships.setMembershipStatus(sub.membershipId, 'cancelled');
        }
        await this.context.manager.getRepository(Subscription).save(sub);
        break;
      }
      default:
        this.logger.warn(`Neobsloužený typ webhooku: ${event.type}`);
    }
  }
}
