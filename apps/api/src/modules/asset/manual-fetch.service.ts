import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { buildFetchPayload, signManualPayload } from './manuals.logic';

/** Výsledek pokusu o spuštění AI stažení manuálu. */
export interface FetchDispatchResult {
  /** `false` = AI stahování není nakonfigurováno (chybí webhook URL). */
  configured: boolean;
}

export interface FetchDispatchInput {
  manualId: string;
  assetId: string;
  tenantId: string;
  name: string;
  manufacturer?: string | null;
  model?: string | null;
}

/**
 * Spouští automatické stažení manuálu „přes AI". Napojení na existující
 * automatizační infra = webhook do n8n (stejný vzor jako MailService +
 * PASSWORD_RESET_WEBHOOK_URL). Když `MANUAL_FETCH_WEBHOOK_URL` není nastaven,
 * vrací `configured=false` (ne chybu) – upload a kamera fungují nezávisle.
 *
 * Kontrakt n8n workflow (viz docs/manual-ai-fetch.md):
 *  1) n8n dostane POST na MANUAL_FETCH_WEBHOOK_URL s tělem
 *     { manualId, assetId, tenantId, name, manufacturer, model, callbackUrl }
 *     a hlavičkou `x-manual-signature` = HMAC-SHA256(hex) těla přes
 *     MANUAL_FETCH_WEBHOOK_SECRET (když je secret nastaven).
 *  2) n8n AI web-searchem najde oficiální PDF manuál a stáhne ho.
 *  3) n8n zavolá `callbackUrl` (POST) buď s binárkou (PDF/obrázek), nebo
 *     s JSON { manualId, fileUrl } – server si soubor stáhne sám. Callback
 *     ověří stejným HMAC podpisem v hlavičce `x-manual-signature`.
 */
@Injectable()
export class ManualFetchService {
  private readonly logger = new Logger(ManualFetchService.name);

  constructor(private readonly config: ConfigService) {}

  /** Je AI stahování nakonfigurováno (je webhook URL)? */
  isConfigured(): boolean {
    return Boolean(this.config.get<string>('MANUAL_FETCH_WEBHOOK_URL'));
  }

  async dispatch(input: FetchDispatchInput): Promise<FetchDispatchResult> {
    const hook = this.config.get<string>('MANUAL_FETCH_WEBHOOK_URL');
    if (!hook) {
      this.logger.warn('MANUAL_FETCH_WEBHOOK_URL není nastaven – AI stahování přeskočeno');
      return { configured: false };
    }

    // Adresa, na kterou n8n zavolá callback. Když API a n8n běží v oddělených
    // docker stacích, `PUBLIC_BASE_URL` (app.tagery.tech) nemíří na API → použij
    // interní `MANUAL_CALLBACK_BASE_URL` (např. http://tagery-api-1:3001).
    const callbackBaseUrl =
      this.config.get<string>('MANUAL_CALLBACK_BASE_URL') ||
      this.config.get<string>('PUBLIC_BASE_URL') ||
      'http://localhost:3001';
    const payload = buildFetchPayload({ ...input, callbackBaseUrl });
    const rawBody = JSON.stringify(payload);

    const headers: Record<string, string> = { 'content-type': 'application/json' };
    const secret = this.config.get<string>('MANUAL_FETCH_WEBHOOK_SECRET');
    if (secret) headers['x-manual-signature'] = signManualPayload(rawBody, secret);

    try {
      await fetch(hook, { method: 'POST', headers, body: rawBody });
    } catch (err) {
      this.logger.error(`Odeslání manual-fetch webhooku selhalo: ${String(err)}`);
      throw err;
    }
    return { configured: true };
  }
}
