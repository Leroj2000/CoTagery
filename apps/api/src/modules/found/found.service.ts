import {
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TenantContextService } from '../../core/tenancy/tenant-context.service';
import { RateLimitService } from '../../core/resolver/rate-limit.service';
import { WebhookService } from '../../core/webhooks/webhook.service';
import { FoundReport } from './entities/found-report.entity';

interface LookupRow {
  tenant_id: string;
  digital_object_id: string | null;
}

/**
 * Nahlášení nálezu. Veřejná část (bez JWT) najde tenanta přes SECURITY DEFINER
 * `activation_lookup` (obchází RLS) a záznam vloží v jeho kontextu (runInTenant).
 * Autentizovaná část je tenant-scoped přes RLS.
 */
@Injectable()
export class FoundService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly context: TenantContextService,
    private readonly rateLimit: RateLimitService,
    private readonly webhooks: WebhookService,
  ) {}

  /** Veřejné nahlášení nálezu (bez JWT). Rate-limited proti zneužití. */
  async report(code: string, message: string, contact: string | undefined, ip: string): Promise<void> {
    const codeOk = await this.rateLimit.allow(`found:code:${code}`, 10, 3600);
    const ipOk = await this.rateLimit.allow(`found:ip:${ip}`, 30, 3600);
    if (!codeOk || !ipOk) {
      throw new HttpException('Příliš mnoho pokusů, zkuste později', HttpStatus.TOO_MANY_REQUESTS);
    }

    const rows: LookupRow[] = await this.dataSource.query('SELECT * FROM activation_lookup($1)', [code]);
    if (rows.length === 0) throw new NotFoundException('Neznámý kód');
    const { tenant_id, digital_object_id } = rows[0];

    await this.context.runInTenant(tenant_id, async () => {
      const repo = this.context.manager.getRepository(FoundReport);
      const saved = await repo.save(
        repo.create({
          tenantId: tenant_id,
          publicCode: code,
          digitalObjectId: digital_object_id,
          message: message.slice(0, 2000),
          finderContact: contact?.slice(0, 200) ?? null,
          status: 'new',
        }),
      );
      await this.webhooks.emit('found_report.created', {
        id: saved.id,
        publicCode: code,
        message: saved.message,
        contact: saved.finderContact,
      });
    });
  }

  // --- Autentizovaná část (majitel) ---
  list(): Promise<FoundReport[]> {
    return this.context.manager
      .getRepository(FoundReport)
      .find({ order: { createdAt: 'DESC' }, take: 200 });
  }

  async handle(id: string): Promise<FoundReport> {
    const repo = this.context.manager.getRepository(FoundReport);
    const report = await repo.findOne({ where: { id } });
    if (!report) throw new NotFoundException('Hlášení neexistuje');
    report.status = 'handled';
    return repo.save(report);
  }
}
