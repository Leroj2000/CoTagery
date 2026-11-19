import { randomBytes } from 'node:crypto';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { signWebhook } from '../../modules/billing/billing.logic';
import { WebhookEndpoint } from './entities/webhook-endpoint.entity';
import { WebhookDelivery } from './entities/webhook-delivery.entity';
import {
  assertSafeWebhookUrl,
  parseAllowedHosts,
  UnsafeUrlError,
  type UrlGuardOptions,
} from './url-guard';

export interface CreateEndpointInput {
  url: string;
  events?: string[];
}

/**
 * Doménové webhooky: tenant si zaregistruje URL, na vybrané události posíláme
 * podepsané POSTy (HMAC-SHA256 v hlavičce `x-tagery-signature`). Doručení se
 * loguje. `emit` běží v tenant kontextu (RLS) volajícího requestu.
 */
@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly context: TenantContextService,
    private readonly config: ConfigService,
  ) {}

  /** SSRF pravidla (BACKLOG SEC-01): produkce jen https, žádné vnitřní adresy. */
  private guardOptions(): UrlGuardOptions {
    return {
      production: this.config.get<string>('NODE_ENV') === 'production',
      allowedHosts: parseAllowedHosts(this.config.get<string>('WEBHOOK_ALLOWED_HOSTS')),
    };
  }

  private endpoints(): Repository<WebhookEndpoint> {
    return this.context.manager.getRepository(WebhookEndpoint);
  }

  list(): Promise<WebhookEndpoint[]> {
    return this.endpoints().find({ order: { createdAt: 'DESC' } });
  }

  listDeliveries(): Promise<WebhookDelivery[]> {
    return this.context.manager
      .getRepository(WebhookDelivery)
      .find({ order: { createdAt: 'DESC' }, take: 100 });
  }

  async create(input: CreateEndpointInput): Promise<WebhookEndpoint> {
    try {
      await assertSafeWebhookUrl(input.url, this.guardOptions());
    } catch (e) {
      if (e instanceof UnsafeUrlError) throw new BadRequestException(e.message);
      throw e;
    }
    return this.endpoints().save(
      this.endpoints().create({
        tenantId: this.context.tenantId,
        url: input.url,
        secret: `whsec_${randomBytes(16).toString('hex')}`,
        events: input.events ?? [],
        active: true,
      }),
    );
  }

  async remove(id: string): Promise<void> {
    const ep = await this.endpoints().findOne({ where: { id } });
    if (!ep) throw new NotFoundException('Endpoint neexistuje');
    await this.endpoints().remove(ep);
  }

  async test(id: string): Promise<WebhookDelivery> {
    const ep = await this.endpoints().findOne({ where: { id } });
    if (!ep) throw new NotFoundException('Endpoint neexistuje');
    return this.deliver(ep, 'ping', { message: 'Testovací událost z Tagery' });
  }

  /**
   * Rozešle událost všem aktivním endpointům odebírajícím `event`
   * (prázdné events = vše). Voláno z domény (movement, inventory, issue, found).
   */
  async emit(event: string, payload: unknown): Promise<void> {
    let eps: WebhookEndpoint[];
    try {
      eps = await this.endpoints().find({ where: { active: true } });
    } catch (e) {
      this.logger.warn(`emit(${event}) – nelze načíst endpointy: ${String(e)}`);
      return;
    }
    const targets = eps.filter((e) => e.events.length === 0 || e.events.includes(event));
    await Promise.all(targets.map((e) => this.deliver(e, event, payload).catch(() => undefined)));
  }

  private async deliver(ep: WebhookEndpoint, event: string, payload: unknown): Promise<WebhookDelivery> {
    const body = JSON.stringify({ event, data: payload, ts: new Date().toISOString() });
    const signature = signWebhook(body, ep.secret);
    const deliveries = this.context.manager.getRepository(WebhookDelivery);

    let statusCode: number | null = null;
    let ok = false;
    let error: string | null = null;
    try {
      // Znovu ověřit těsně před odesláním (DNS se mohlo změnit, starší endpointy).
      await assertSafeWebhookUrl(ep.url, this.guardOptions());
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(ep.url, {
        redirect: 'manual',
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tagery-event': event,
          'x-tagery-signature': signature,
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      statusCode = res.status;
      ok = res.ok;
    } catch (e) {
      error = e instanceof Error ? e.message : 'chyba doručení';
    }

    return deliveries.save(
      deliveries.create({
        tenantId: this.context.tenantId,
        endpointId: ep.id,
        event,
        statusCode,
        ok,
        error,
      }),
    );
  }
}
