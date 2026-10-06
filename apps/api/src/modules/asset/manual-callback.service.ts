import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';
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

/**
 * SSRF guard (M3 hardening): `fileUrl` v callbacku je request-controlled (AI
 * výstup z n8n, a bez `MANUAL_FETCH_WEBHOOK_SECRET` i kýmkoliv jiným) – server
 * by jinak na požádání stáhl obsah libovolné interní adresy (loopback, privátní
 * rozsahy, link-local/cloud metadata 169.254.169.254 apod.). Blokuje jen
 * vyhrazené/privátní rozsahy, veřejný internet (očekávaný cíl – výrobce manuálu)
 * zůstává bez omezení.
 */
function isBlockedIp(ip: string): boolean {
  const v4mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  const addr = v4mapped ? v4mapped[1] : ip;

  if (isIP(addr) === 4) {
    const parts = addr.split('.').map(Number);
    const [a, b] = parts;
    if (a === 127) return true; // loopback
    if (a === 10) return true; // RFC1918 private
    if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918 private
    if (a === 192 && b === 168) return true; // RFC1918 private
    if (a === 169 && b === 254) return true; // link-local, vč. cloud metadata
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT (RFC6598)
    if (a === 0) return true; // "this network"
    if (a >= 224) return true; // multicast + reserved
    return false;
  }
  if (isIP(addr) === 6) {
    const lower = addr.toLowerCase();
    if (lower === '::1' || lower === '::') return true; // loopback / unspecified
    if (/^fe[89ab]/.test(lower)) return true; // link-local fe80::/10
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local fc00::/7
    return false;
  }
  return true; // nerozpoznaná adresa – blokuj konzervativně
}

/** Ověří, že URL je http(s) a nesměřuje na vyhrazenou/privátní adresu (SSRF guard). */
async function assertPublicHttpUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Neplatná URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Nepovolené schéma URL');
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (hostname === 'localhost') throw new Error('Nepovolený cíl (localhost)');

  const addresses =
    isIP(hostname) !== 0 ? [hostname] : (await lookup(hostname, { all: true })).map((r) => r.address);
  if (addresses.length === 0 || addresses.some(isBlockedIp)) {
    throw new Error('Nepovolený cíl (interní/vyhrazená adresa)');
  }
  return url;
}

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

  /**
   * Stáhne odkaz s časovým limitem (AI odkaz může být pomalý/nedostupný).
   * SSRF guard: cíl i každé přesměrování se ověří přes `assertPublicHttpUrl`
   * (redirect: 'manual' – fetch nesmí tiše skočit na blokovanou adresu).
   */
  private async download(url: string): Promise<{ buffer: Buffer; contentType: string | null }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20_000);
    try {
      let target = await assertPublicHttpUrl(url);
      for (let hop = 0; hop < 5; hop += 1) {
        const res = await fetch(target, { signal: controller.signal, redirect: 'manual' });
        if (res.status >= 300 && res.status < 400) {
          const location = res.headers.get('location');
          if (!location) throw new Error(`HTTP ${res.status} bez Location`);
          target = await assertPublicHttpUrl(new URL(location, target).toString());
          continue;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const contentType = res.headers.get('content-type');
        const buffer = Buffer.from(await res.arrayBuffer());
        return { buffer, contentType };
      }
      throw new Error('Příliš mnoho přesměrování');
    } finally {
      clearTimeout(timer);
    }
  }
}
