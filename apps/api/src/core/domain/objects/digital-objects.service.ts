import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { DigitalObject } from '../entities/digital-object.entity';
import type { CreateDigitalObjectDto } from './dto/create-digital-object.dto';
import type { UpdateDigitalObjectDto } from './dto/update-digital-object.dto';

@Injectable()
export class DigitalObjectsService {
  constructor(private readonly context: TenantContextService) {}

  private repo(): Repository<DigitalObject> {
    return this.context.manager.getRepository(DigitalObject);
  }

  list(): Promise<DigitalObject[]> {
    return this.repo().find({ order: { createdAt: 'DESC' } });
  }

  create(dto: CreateDigitalObjectDto): Promise<DigitalObject> {
    const object = this.repo().create({
      tenantId: this.context.tenantId,
      moduleType: dto.moduleType,
      slug: dto.slug ?? `${dto.moduleType}-${Date.now().toString(36)}`,
      primaryUrl: dto.primaryUrl ?? null,
      metadata: dto.metadata ?? {},
      validFrom: dto.validFrom ? new Date(dto.validFrom) : null,
      validTo: dto.validTo ? new Date(dto.validTo) : null,
    });
    return this.repo().save(object);
  }

  async get(id: string): Promise<DigitalObject> {
    const object = await this.repo().findOne({ where: { id } });
    if (!object) throw new NotFoundException('Objekt neexistuje');
    return object;
  }

  async update(id: string, dto: UpdateDigitalObjectDto): Promise<DigitalObject> {
    const object = await this.get(id);
    if (dto.status !== undefined) object.status = dto.status;
    if (dto.primaryUrl !== undefined) object.primaryUrl = dto.primaryUrl;
    if (dto.metadata !== undefined) object.metadata = dto.metadata;
    if (dto.validTo !== undefined) object.validTo = dto.validTo ? new Date(dto.validTo) : null;
    return this.repo().save(object);
  }

  async archive(id: string): Promise<void> {
    const object = await this.get(id);
    object.status = 'archived';
    await this.repo().save(object);
  }
}
