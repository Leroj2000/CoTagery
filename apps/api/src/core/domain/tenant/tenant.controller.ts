import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { RequirePermission } from '../../rbac/require-permission.decorator';
import { TenantService } from './tenant.service';
import { UpdateTenantDto } from './dto/tenant.dto';
import type { Tenant } from '../entities/tenant.entity';

/** Nastavení aktuálního tenanta (EPIC-03). Změny jen ADMIN+. */
@Controller('tenant')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TenantController {
  constructor(private readonly tenant: TenantService) {}

  @Get()
  @RequirePermission('core.organization.view')
  current(): Promise<Tenant> {
    return this.tenant.current();
  }

  @Patch()
  @RequirePermission('core.organization.configure')
  update(@Body() dto: UpdateTenantDto): Promise<Tenant> {
    return this.tenant.update(dto);
  }
}
