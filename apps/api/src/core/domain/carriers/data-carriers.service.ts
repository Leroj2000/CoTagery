import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueryFailedError, Repository } from 'typeorm';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { DataCarrier } from '../entities/data-carrier.entity';
import { DigitalObject } from '../entities/digital-object.entity';
import { generatePublicCode } from '../public-code';
import type { CreateDataCarrierDto, NfcPairDto } from './dto/carrier.dto';

const UNIQUE_VIOLATION = '23505';

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

  listForObject(objectId: string): Promise<DataCarrier[]> {
    return this.carriers().find({
      where: { digitalObjectId: objectId },
      order: { createdAt: 'ASC' },
    });
  }

  async createForObject(objectId: string, dto: CreateDataCarrierDto): Promise<DataCarrier> {
    await this.assertObject(objectId);
    const base = this.config.get<string>('PUBLIC_BASE_URL') ?? 'http://localhost:3001';

    // Generuj public_code s retry na (nepravděpodobnou) kolizi unikátního indexu.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const publicCode = generatePublicCode();
      const resolverUrl = `${base}/r/${publicCode}`;
      const carrier = this.carriers().create({
        tenantId: this.context.tenantId,
        digitalObjectId: objectId,
        carrierType: dto.carrierType ?? 'qr',
        publicCode,
        resolverUrl,
        qrPayload: resolverUrl,
      });
      try {
        return await this.carriers().save(carrier);
      } catch (err) {
        if (err instanceof QueryFailedError && (err.driverError as { code?: string }).code === UNIQUE_VIOLATION) {
          continue; // kolize public_code – zkus znovu
        }
        throw err;
      }
    }
    throw new Error('Nepodařilo se vygenerovat unikátní public_code');
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
