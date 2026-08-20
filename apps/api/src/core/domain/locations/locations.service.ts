import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { Location } from '../entities/location.entity';
import type { CreateLocationDto } from './dto/create-location.dto';
import type { UpdateLocationDto } from './dto/update-location.dto';

/**
 * Všechny dotazy jdou přes tenant-scoped manager (transakce se `app.tenant_id`),
 * takže RLS automaticky vrací jen data aktuálního tenantu (ADR-0001).
 */
@Injectable()
export class LocationsService {
  constructor(private readonly context: TenantContextService) {}

  private repo(): Repository<Location> {
    return this.context.manager.getRepository(Location);
  }

  list(): Promise<Location[]> {
    return this.repo().find({ order: { createdAt: 'ASC' } });
  }

  create(dto: CreateLocationDto): Promise<Location> {
    const location = this.repo().create({
      ...dto,
      tenantId: this.context.tenantId, // z JWT kontextu, nikdy z těla requestu
    });
    return this.repo().save(location);
  }

  async get(id: string): Promise<Location> {
    const location = await this.repo().findOne({ where: { id } });
    if (!location) throw new NotFoundException('Lokace neexistuje');
    return location;
  }

  async update(id: string, dto: UpdateLocationDto): Promise<Location> {
    const location = await this.get(id);
    if (dto.parentId === id) throw new BadRequestException('Lokace nemůže být rodičem sama sobě');
    if (dto.name !== undefined) location.name = dto.name;
    if (dto.type !== undefined) location.type = dto.type;
    if (dto.address !== undefined) location.address = dto.address || null;
    if (dto.timezone) location.timezone = dto.timezone;
    if (dto.parentId !== undefined) location.parentId = dto.parentId || null;
    return this.repo().save(location);
  }
}
