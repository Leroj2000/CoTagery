import { randomInt } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueryFailedError, Repository } from 'typeorm';
import { hash as argonHash } from '@node-rs/argon2';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { DataCarrier } from '../entities/data-carrier.entity';
import { DigitalObject } from '../entities/digital-object.entity';
import { generatePublicCode } from '../public-code';
import type {
  AdoptCarrierDto,
  CreateDataCarrierDto,
  GenerateBatchDto,
  NfcPairDto,
} from './dto/carrier.dto';

const UNIQUE_VIOLATION = '23505';
const MAX_BATCH = 500;

export interface GeneratedCarrier {
  carrier: DataCarrier;
  /** Plaintext PIN pro tisk – vrací se JEN teď (v DB je jen hash). */
  pin: string | null;
}

@Injectable()
export class DataCarriersService {
  constructor(
    private readonly context: TenantContextService,
    private readonly config: ConfigService,
  ) {}

  private carriers(): Repository<DataCarrier> {
    return this.context.manager.getRepository(DataCarrier);
  }

  private objects(): Repository<DigitalObject> {
    return this.context.manager.getRepository(DigitalObject);
  }

  private async assertObject(objectId: string): Promise<DigitalObject> {
    const object = await this.objects().findOne({ where: { id: objectId } });
    if (!object) throw new NotFoundException('Objekt neexistuje');
    return object;
  }

  /** Vytvoří identifikátor s unikátním public_code (retry na kolizi). */
  private async createCarrier(
    digitalObjectId: string | null,
    carrierType: 'qr' | 'nfc' | 'hybrid',
    status: 'unassigned' | 'active',
    extra?: Partial<DataCarrier>,
  ): Promise<DataCarrier> {
    const base = this.config.get<string>('PUBLIC_BASE_URL') ?? 'http://localhost:3001';
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const publicCode = generatePublicCode();
      const resolverUrl = `${base}/r/${publicCode}`;
      const carrier = this.carriers().create({
        tenantId: this.context.tenantId,
        digitalObjectId,
        carrierType,
        publicCode,
        resolverUrl,
        qrPayload: resolverUrl,
        status,
        ...extra,
      });
      try {
        return await this.carriers().save(carrier);
      } catch (err) {
        if (
          err instanceof QueryFailedError &&
          (err.driverError as { code?: string }).code === UNIQUE_VIOLATION
        ) {
          continue;
        }
        throw err;
      }
    }
    throw new Error('Nepodařilo se vygenerovat unikátní public_code');
  }

  listForObject(objectId: string): Promise<DataCarrier[]> {
    return this.carriers().find({
      where: { digitalObjectId: objectId },
      order: { createdAt: 'ASC' },
    });
  }

  async createForObject(objectId: string, dto: CreateDataCarrierDto): Promise<DataCarrier> {
    await this.assertObject(objectId);
    return this.createCarrier(objectId, dto.carrierType ?? 'qr', 'active');
  }

  /**
   * Adopce cizího identifikátoru: uloží externí kód jako ALIAS (rozpozná ho jen
   * interní skener v tenant kontextu) a ZÁROVEŇ vygeneruje náš nativní public_code,
   * takže carrier je použitelný i pro veřejný resolver. Veřejný path se nemění.
   */
  async adoptExternal(objectId: string, dto: AdoptCarrierDto): Promise<DataCarrier> {
    await this.assertObject(objectId);
    const externalCode = dto.externalCode.trim();
    if (!externalCode) throw new BadRequestException('Externí kód je prázdný');

    // Per-tenant: kód nesmí být adoptovaný dvakrát (index je backstop na race).
    const existing = await this.carriers().findOne({ where: { externalCode } });
    if (existing) {
      throw new BadRequestException('Tento kód je už adoptovaný u jiné věci');
    }

    return this.createCarrier(objectId, dto.carrierType ?? 'qr', 'active', {
      externalCode,
      externalScheme: dto.externalScheme ?? 'custom',
      origin: 'adopted',
    });
  }

  /**
   * Interní lookup naskenovaného kódu (tenant kontext): pozná náš public_code
   * i adoptovaný external_code. NEPOUŽÍVAT ve veřejném resolveru (ten jede jen
   * přes public_code přes SECURITY DEFINER).
   */
  findByCode(code: string): Promise<DataCarrier | null> {
    const trimmed = code.trim();
    return this.carriers().findOne({
      where: [{ publicCode: trimmed }, { externalCode: trimmed }],
    });
  }

  /**
   * Předgeneruje N nepřiřazených identifikátorů (pool k tisku). Při `selfActivatable`
   * ke každému vygeneruje 6místný PIN (v DB jen hash) – vrací se plaintext k tisku.
   */
  async generateBatch(dto: GenerateBatchDto): Promise<GeneratedCarrier[]> {
    if (dto.count < 1 || dto.count > MAX_BATCH) {
      throw new BadRequestException(`count musí být 1..${MAX_BATCH}`);
    }
    if (dto.selfActivatable && !dto.moduleTemplate) {
      throw new BadRequestException('selfActivatable vyžaduje moduleTemplate');
    }
    const carrierType = dto.carrierType ?? 'qr';
    const result: GeneratedCarrier[] = [];
    for (let i = 0; i < dto.count; i += 1) {
      let pin: string | null = null;
      const extra: Partial<DataCarrier> = {};
      if (dto.selfActivatable) {
        pin = String(randomInt(0, 1_000_000)).padStart(6, '0');
        extra.selfActivatable = true;
        extra.moduleTemplate = dto.moduleTemplate ?? null;
        extra.activationPinHash = await argonHash(pin);
      }
      const carrier = await this.createCarrier(null, carrierType, 'unassigned', extra);
      result.push({ carrier, pin });
    }
    return result;
  }

  listUnassigned(): Promise<DataCarrier[]> {
    return this.carriers().find({
      where: { status: 'unassigned' },
      order: { createdAt: 'ASC' },
    });
  }

  /** ID digitálních objektů, které mají aspoň jeden přiřazený identifikátor (pro UI kontrolu). */
  async assignedObjectIds(): Promise<string[]> {
    const rows = await this.carriers()
      .createQueryBuilder('c')
      .select('DISTINCT c.digital_object_id', 'objectId')
      .where('c.digital_object_id IS NOT NULL')
      .getRawMany<{ objectId: string }>();
    return rows.map((r) => r.objectId);
  }

  /** Přiřadí předgenerovaný kód k objektu (claim). */
  async claim(publicCode: string, objectId: string): Promise<DataCarrier> {
    const carrier = await this.carriers().findOne({ where: { publicCode } });
    if (!carrier) throw new NotFoundException('Kód neexistuje');
    if (carrier.digitalObjectId) {
      throw new BadRequestException('Kód už je přiřazený');
    }
    await this.assertObject(objectId);
    carrier.digitalObjectId = objectId;
    carrier.status = 'active';
    return this.carriers().save(carrier);
  }

  async get(id: string): Promise<DataCarrier> {
    const carrier = await this.carriers().findOne({ where: { id } });
    if (!carrier) throw new NotFoundException('Identifikátor neexistuje');
    return carrier;
  }

  async pairNfc(id: string, dto: NfcPairDto): Promise<DataCarrier> {
    const carrier = await this.get(id);
    carrier.nfcUid = dto.nfcUid;
    carrier.nfcPayload = dto.nfcPayload ?? carrier.resolverUrl;
    carrier.carrierType = carrier.carrierType === 'qr' ? 'hybrid' : 'nfc';
    return this.carriers().save(carrier);
  }
}
