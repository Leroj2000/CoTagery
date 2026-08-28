import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { TenantContextService } from '../../core/tenancy/tenant-context.service';
import { ManualsService } from './manuals.service';
import { validateDownloadedManual, verifyManualSignature } from './manuals.logic';

interface CallbackEnvelope {
  manualId?: string;
  /** Buď soubor přijde jako `fileUrl` (server si stáhne), nebo `failed=true`. */
  fileUrl?: string;
  failed?: boolean;
  sourceUrl?: string;
  /** Volitelný důvod selhání z workflow (jinak API dovodí srozumitelnou hlášku). */
  reason?: string;
}

interface ManualLookupRow {
  manual_id: string;
  tenant_id: string;
}

export interface CallbackResult {
  received: true;
  status: 'ready' | 'failed';
}

/**
 * Zpracování callbacku z n8n (AI stažení manuálu). Bez JWT: ověří HMAC podpis,
 * dohledá tenanta přes SECURITY DEFINER lookup, pak v tenant kontextu doplní
 * soubor. Idempotentní vůči už dokončeným manuálům. Vzor: BillingWebhookService.
 */
@Injectable()
export class ManualCallbackService {
  private readonly logger = new Logger(ManualCallbackService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly context: TenantContextService,
    private readonly manuals: ManualsService,
    private readonly config: ConfigService,
  ) {}

  async handle(rawBody: string, signature: string): Promise<CallbackResult> {
    const secret = this.config.get<string>('MANUAL_FETCH_WEBHOOK_SECRET');
    // Když je secret nastaven, podpis je povinný a musí sedět.
    if (secret && !verifyManualSignature(rawBody, signature, secret)) {
      throw new UnauthorizedException('Neplatný podpis callbacku');
    }

    let event: CallbackEnvelope;
    try {
      event = JSON.parse(rawBody) as CallbackEnvelope;
    } catch {
      throw new BadRequestException('Neplatné JSON tělo');
    }
    if (!event.manualId) throw new BadRequestException('Chybí manualId');

    const rows: ManualLookupRow[] = await this.dataSource.query(
      'SELECT * FROM asset_manual_lookup($1)',
      [event.manualId],
    );
    if (rows.length === 0) throw new NotFoundException('Neznámý manuál');
    const tenantId = rows[0].tenant_id;
    const manualId = rows[0].manual_id;

    return this.context.runInTenant(tenantId, async () => {
      if (event.failed) {
        await this.manuals.markFailed(manualId, event.reason);
        return { received: true, status: 'failed' };
      }
      if (!event.fileUrl) throw new BadRequestException('Chybí fileUrl nebo failed');

      // Fail-fast: když stažení odkazu selže NEBO to není platné PDF/obrázek
      // (AI často vrátí odkaz na HTML stránku „ke stažení"), rovnou označ jako
      // `failed` se srozumitelným důvodem – ať řádek nevisí do timeoutu.
      let downloaded: { buffer: Buffer; contentType: string | null };
      try {
        downloaded = await this.download(event.fileUrl);
      } catch (err) {
        const detail = err instanceof Error && err.name === 'AbortError' ? 'příliš pomalý' : 'nedostupný';
        await this.manuals.markFailed(manualId, `Nalezený odkaz na manuál je ${detail}.`);
        return { received: true, status: 'failed' };
      }

      const check = validateDownloadedManual(downloaded.buffer, downloaded.contentType);
      if ('error' in check) {
        await this.manuals.markFailed(manualId, `Nalezený odkaz nebyl platný manuál – ${check.error}.`);
        return { received: true, status: 'failed' };
      }

      await this.manuals.completeFromCallback(manualId, {
        buffer: downloaded.buffer,
        mime: check.mime,
        sourceUrl: event.sourceUrl ?? event.fileUrl,
      });
      return { received: true, status: 'ready' };
    });
  }

  /** Stáhne odkaz s časovým limitem (AI odkaz může být pomalý/nedostupný). */
  private async download(url: string): Promise<{ buffer: Buffer; contentType: string | null }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const contentType = res.headers.get('content-type');
      const buffer = Buffer.from(await res.arrayBuffer());
      return { buffer, contentType };
    } finally {
      clearTimeout(timer);
    }
  }
}
