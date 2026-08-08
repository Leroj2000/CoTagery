import { Controller, Get, Headers, Ip, Param, Query, Res } from '@nestjs/common';
import { ResolverService } from './resolver.service';
import { RateLimitService } from './rate-limit.service';
import { ScanLoggerService } from './scan-logger.service';
import { ModuleRegistry } from '../domain/module-handler';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { isActiveResolution } from './resolution';

/** Minimální tvar Express Response (bez závislosti na typech express). */
interface HttpResponse {
  status(code: number): HttpResponse;
  json(body: unknown): void;
  redirect(code: number, url: string): void;
}

/** Veřejný resolver hot path `GET /r/{public_code}` (mimo /api/v1 prefix). */
@Controller('r')
export class ResolverController {
  constructor(
    private readonly resolver: ResolverService,
    private readonly rateLimit: RateLimitService,
    private readonly scanLogger: ScanLoggerService,
    private readonly registry: ModuleRegistry,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Get(':code')
  async resolve(
    @Param('code') code: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('accept') accept: string | undefined,
    @Query('format') format: string | undefined,
    @Res() res: HttpResponse,
  ): Promise<void> {
    // Anti-quishing rate limit: per IP a per public_code.
    const ipOk = await this.rateLimit.allow(`rl:ip:${ip}`, 120, 60);
    const codeOk = await this.rateLimit.allow(`rl:code:${code}`, 240, 60);
    if (!ipOk || !codeOk) {
      res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Příliš mnoho požadavků' } });
      return;
    }

    const resolution = await this.resolver.resolve(code);
    if (!resolution) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Neznámý kód' } });
      return;
    }

    if (!isActiveResolution(resolution)) {
      res.status(410).json({ error: { code: 'INACTIVE', message: 'Kód není aktivní nebo vypršel' } });
      return;
    }

    // Async ScanEvent (fire-and-forget – neblokuje odpověď).
    this.scanLogger.record(resolution, {
      carrierType: resolution.carrierType,
      ip,
      userAgent: userAgent ?? null,
    });

    // Modulový handler (pokud zaregistrován); jinak default níže.
    const handler = this.registry.get(resolution.moduleType);
    if (handler) {
      const carrier = {
        id: resolution.carrierId,
        tenantId: resolution.tenantId,
      } as never;
      const object = {
        id: resolution.objectId,
        tenantId: resolution.tenantId,
        moduleType: resolution.moduleType,
      } as never;
      // Handler běží v tenant kontextu (RLS) daném resolucí – může číst svá data.
      const response = await this.tenantContext.runInTenant(resolution.tenantId, () =>
        handler.handleScan(object, carrier, {
          carrierType: resolution.carrierType === 'nfc' ? 'nfc' : 'qr',
          ip,
          userAgent,
        }),
      );
      if (response.kind === 'redirect' && response.url) {
        res.redirect(302, response.url);
        return;
      }
      res.status(200).json(response.body ?? {});
      return;
    }

    // Default: JSON (dle Accept/format) nebo redirect na primary_url.
    const wantsJson = format === 'json' || (accept ?? '').includes('application/json');
    if (!wantsJson && resolution.primaryUrl) {
      res.redirect(302, resolution.primaryUrl);
      return;
    }
    res.status(200).json({
      object: { id: resolution.objectId, moduleType: resolution.moduleType, slug: resolution.slug },
      carrier: { type: resolution.carrierType },
      primaryUrl: resolution.primaryUrl,
    });
  }
}
