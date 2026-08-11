import { Injectable, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { Tenant } from '../entities/tenant.entity';
import type { UpdateTenantDto } from './dto/tenant.dto';

/**
 * Nastavení aktuálního tenanta (EPIC-03). Tabulka `tenants` není RLS-scoped
 * (je to sám tenant), proto scope explicitně přes `context.tenantId` z JWT –
 * nikdy z URL/body (kritické pravidlo).
 */
@Injectable()
export class TenantService {
  constructor(private readonly context: TenantContextService) {}

  private repo(): Repository<Tenant> {
    return this.context.manager.getRepository(Tenant);
  }

  async current(): Promise<Tenant> {
    const tenant = await this.repo().findOne({ where: { id: this.context.tenantId } });
    if (!tenant) throw new NotFoundException('Tenant neexistuje');
    return tenant;
  }

  async update(dto: UpdateTenantDto): Promise<Tenant> {
    const tenant = await this.current();
    if (dto.name !== undefined) tenant.name = dto.name;
    if (dto.brandingDomain !== undefined) tenant.brandingDomain = dto.brandingDomain || null;
    if (dto.settings !== undefined) tenant.settings = dto.settings;
    return this.repo().save(tenant);
  }
}
