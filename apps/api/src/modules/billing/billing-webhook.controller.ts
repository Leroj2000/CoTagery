import { BadRequestException, Controller, Headers, Post, Req } from '@nestjs/common';
import { BillingWebhookService, type WebhookResult } from './billing-webhook.service';

/** Minimální tvar requestu s raw body (viz `rawBody: true` v main.ts). */
interface RawBodyReq {
  rawBody?: Buffer;
}

/**
 * Veřejný PSP webhook endpoint (EPIC-17) – bez JWT. Ověření podpisu + tenant
 * scoping řeší service. Potřebuje raw body (viz `rawBody: true` v main.ts).
 */
@Controller('billing/webhook')
export class BillingWebhookController {
  constructor(private readonly webhook: BillingWebhookService) {}

  @Post()
  handle(
    @Req() req: RawBodyReq,
    @Headers('x-psp-signature') signature: string,
  ): Promise<WebhookResult> {
    const raw = req.rawBody?.toString('utf8');
    if (!raw) throw new BadRequestException('Chybí tělo požadavku');
    return this.webhook.handle(raw, signature ?? '');
  }
}
