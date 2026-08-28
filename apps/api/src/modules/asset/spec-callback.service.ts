import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { TenantContextService } from '../../core/tenancy/tenant-context.service';
import { SpecsService } from './specs.service';
import { verifyManualSignature } from './manuals.logic';

interface SpecCallbackEnvelope {
  specId?: string;
  /** Pole specifikací {label,value}, které AI dohledala. */
  specs?: unknown;
  sourceUrl?: string;
  failed?: boolean;
  reason?: string;
}

interface SpecLookupRow {
  spec_id: string;
  tenant_id: string;
}

export interface SpecCallbackResult {
  received: true;
  status: 'ready' | 'failed';
}

/**
 * Zpracuje callback z n8n s dohledanými specifikacemi (bez JWT). Ověří HMAC
 * podpis (sdílený `MANUAL_FETCH_WEBHOOK_SECRET`), dohledá tenanta přes SECURITY
 * DEFINER a uloží specifikace v jeho kontextu (runInTenant).
 */
@Injectable()
export class SpecCallbackService {
  constructor(
    private readonly specs: SpecsService,
    private readonly context: TenantContextService,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async handle(rawBody: string, signature: string): Promise<SpecCallbackResult> {
    const secret = this.config.get<string>('MANUAL_FETCH_WEBHOOK_SECRET');
    if (secret && !verifyManualSignature(rawBody, signature, secret)) {
      throw new UnauthorizedException('Neplatný podpis callbacku');
    }

    let event: SpecCallbackEnvelope;
    try {
      event = JSON.parse(rawBody) as SpecCallbackEnvelope;
    } catch {
      throw new BadRequestException('Neplatné JSON tělo');
    }
    if (!event.specId) throw new BadRequestException('Chybí specId');

    const rows: SpecLookupRow[] = await this.dataSource.query(
      'SELECT * FROM asset_spec_lookup($1)',
      [event.specId],
    );
    if (rows.length === 0) throw new NotFoundException('Neznámé specifikace');
    const { tenant_id: tenantId, spec_id: specId } = rows[0];

    return this.context.runInTenant(tenantId, async () => {
      if (event.failed) {
        await this.specs.markFailed(specId, event.reason);
        return { received: true, status: 'failed' };
      }
      await this.specs.completeFromCallback(specId, event.specs, event.sourceUrl ?? null);
      return { received: true, status: 'ready' };
    });
  }
}
