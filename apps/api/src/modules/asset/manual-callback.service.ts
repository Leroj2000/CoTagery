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
import { verifyManualSignature } from './manuals.logic';

interface CallbackEnvelope {
  manualId?: string;
  /** Buď soubor přijde jako `fileUrl` (server si stáhne), nebo `failed=true`. */
  fileUrl?: string;
  failed?: boolean;
  sourceUrl?: string;
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
        await this.manuals.markFailed(manualId);
        return { received: true, status: 'failed' };
      }
      if (!event.fileUrl) throw new BadRequestException('Chybí fileUrl nebo failed');

      const { buffer, mime } = await this.download(event.fileUrl);
      await this.manuals.completeFromCallback(manualId, {
        buffer,
        mime,
        sourceUrl: event.sourceUrl ?? event.fileUrl,
      });
      return { received: true, status: 'ready' };
    });
  }

  private async download(url: string): Promise<{ buffer: Buffer; mime: string }> {
    const res = await fetch(url);
    if (!res.ok) throw new BadRequestException(`Stažení souboru selhalo (${res.status})`);
    const mime = res.headers.get('content-type')?.split(';')[0]?.trim() ?? 'application/pdf';
    const buffer = Buffer.from(await res.arrayBuffer());
    return { buffer, mime };
  }
}
