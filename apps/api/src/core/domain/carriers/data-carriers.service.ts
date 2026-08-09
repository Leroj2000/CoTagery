import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueryFailedError, Repository } from 'typeorm';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { DataCarrier } from '../entities/data-carrier.entity';
import { DigitalObject } from '../entities/digital-object.entity';
import { generatePublicCode } from '../public-code';
import type { CreateDataCarrierDto, NfcPairDto } from './dto/carrier.dto';

const UNIQUE_VIOLATION = '23505';
const MAX_BATCH = 500;

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

  /** Vytvoří nosič s unikátním public_code (retry na kolizi). */
  private async createCarrier(
    digitalObjectId: string | null,
    carrierType: 'qr' | 'nfc' | 'hybrid',
    status: 'unassigned' | 'active',
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

  /** Předgeneruje N nepřiřazených nosičů (pool k tisku a pozdějšímu claim). */
  async generateBatch(count: number, carrierType: 'qr' | 'nfc' | 'hybrid'): Promise<DataCarrier[]> {
    if (count < 1 || count > MAX_BATCH) {
      throw new BadRequestException(`count musí být 1..${MAX_BATCH}`);
    }
    const created: DataCarrier[] = [];
    for (let i = 0; i < count; i += 1) {
      created.push(await this.createCarrier(null, carrierType, 'unassigned'));
    }
    return created;
  }

  listUnassigned(): Promise<DataCarrier[]> {
    return this.carriers().find({
      where: { status: 'unassigned' },
      order: { createdAt: 'ASC' },
    });
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
    if (!carrier) throw new NotFoundException('Nosič neexistuje');
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
