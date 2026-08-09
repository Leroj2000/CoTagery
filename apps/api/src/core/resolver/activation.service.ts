import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { verify as argonVerify } from '@node-rs/argon2';
import type { ModuleType } from '@tagery/shared';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { RateLimitService } from './rate-limit.service';
import { DigitalObject } from '../domain/entities/digital-object.entity';
import { DataCarrier } from '../domain/entities/data-carrier.entity';
import { generatePublicCode } from '../domain/public-code';

interface ActivationRow {
  carrier_id: string;
  tenant_id: string;
  self_activatable: boolean;
  module_template: ModuleType | null;
  activation_pin_hash: string | null;
  digital_object_id: string | null;
}

export interface ActivationResult {
  objectId: string;
  editToken: string;
  publicCode: string;
}

/**
 * Veřejná self-aktivace koncovým příjemcem (PIN varianta). Běží bez JWT tenanta;
 * nosič se najde přes SECURITY DEFINER `activation_lookup`, objekt se vytvoří
 * v kontextu vlastnícího tenanta (runInTenant → RLS). Anti-brute-force: rate limit.
 */
@Injectable()
export class ActivationService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly context: TenantContextService,
    private readonly jwt: JwtService,
    private readonly rateLimit: RateLimitService,
  ) {}

  async activate(
    code: string,
    pin: string,
    payload: Record<string, unknown> | undefined,
    ip: string,
  ): Promise<ActivationResult> {
    // Anti-brute-force: přísný limit na pokusy per kód i per IP.
    const codeOk = await this.rateLimit.allow(`act:code:${code}`, 10, 3600);
    const ipOk = await this.rateLimit.allow(`act:ip:${ip}`, 30, 3600);
    if (!codeOk || !ipOk) {
      throw new HttpException('Příliš mnoho pokusů, zkuste později', HttpStatus.TOO_MANY_REQUESTS);
    }

    const rows: ActivationRow[] = await this.dataSource.query(
      'SELECT * FROM activation_lookup($1)',
      [code],
    );
    if (rows.length === 0) throw new NotFoundException('Neznámý kód');
    const row = rows[0];

    if (row.digital_object_id) throw new BadRequestException('Kód už je aktivovaný');
    if (!row.self_activatable || !row.module_template) {
      throw new ForbiddenException('Tento kód nelze aktivovat veřejně');
    }
    if (!row.activation_pin_hash || !(await argonVerify(row.activation_pin_hash, pin))) {
      throw new UnauthorizedException('Neplatný PIN');
    }

    const moduleType = row.module_template;
    const primaryUrl = typeof payload?.url === 'string' ? payload.url : null;

    // Objekt vzniká v kontextu vlastnícího tenanta (RLS přes runInTenant).
    const object = await this.context.runInTenant(row.tenant_id, async () => {
      const manager = this.context.manager;
      const saved = await manager.getRepository(DigitalObject).save(
        manager.getRepository(DigitalObject).create({
          tenantId: row.tenant_id,
          moduleType,
          slug: `${moduleType}-${generatePublicCode(8).toLowerCase()}`,
          primaryUrl,
          metadata: payload ?? {},
          status: 'active',
        }),
      );
      const carrierRepo = manager.getRepository(DataCarrier);
      const carrier = await carrierRepo.findOne({ where: { id: row.carrier_id } });
      if (carrier) {
        carrier.digitalObjectId = saved.id;
        carrier.status = 'active';
        carrier.selfActivatable = false;
        carrier.activationPinHash = null; // spotřebováno
        await carrierRepo.save(carrier);
      }
      return saved;
    });

    // Edit-token: bearer omezený na tento jeden objekt (delegovaná práva příjemci).
    const editToken = await this.jwt.signAsync(
      { sub: 'end-user', objectId: object.id, tenantId: row.tenant_id, scope: 'object-edit' },
      { expiresIn: '365d' as JwtSignOptions['expiresIn'] },
    );

    return { objectId: object.id, editToken, publicCode: code };
  }
}
