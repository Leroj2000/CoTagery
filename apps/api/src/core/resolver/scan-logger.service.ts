import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { Resolution } from './resolution';

export interface ScanLogContext {
  carrierType: string;
  eventType?: string;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Asynchronní zápis ScanEventu (ADR-0002: neblokuje odpověď resolveru).
 * Volá se fire-and-forget; chyba se jen zaloguje, resolver nespadne.
 * (Plná fronta – BullMQ / Cloudflare Queues – je pozdější vylepšení.)
 */
@Injectable()
export class ScanLoggerService {
  private readonly logger = new Logger(ScanLoggerService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  record(resolution: Resolution, ctx: ScanLogContext): void {
    this.dataSource
      .query('SELECT log_scan($1,$2,$3,$4,$5,$6,$7)', [
        resolution.tenantId,
        resolution.objectId,
        resolution.carrierId,
        ctx.carrierType,
        ctx.eventType ?? 'scan',
        ctx.ip ?? null,
        ctx.userAgent ?? null,
      ])
      .catch((err: unknown) => this.logger.warn(`Zápis ScanEvent selhal: ${String(err)}`));
  }
}
