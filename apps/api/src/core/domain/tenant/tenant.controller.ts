import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard, RequireRole } from '../../rbac/roles.guard';
import { TenantService } from './tenant.service';
import { UpdateTenantDto } from './dto/tenant.dto';
import type { Tenant } from '../entities/tenant.entity';

/** Nastavení aktuálního tenanta (EPIC-03). Změny jen ADMIN+. */
@Controller('tenant')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantController {
  constructor(private readonly tenant: TenantService) {}

  @Get()
  current(): Promise<Tenant> {
    return this.tenant.current();
  }

  @Patch()
  @RequireRole('ADMIN')
  update(@Body() dto: UpdateTenantDto): Promise<Tenant> {
    return this.tenant.update(dto);
  }
}
