import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PlatformAdminGuard } from './platform-admin.guard';
import { PlatformService, type CreatedTenant, type TenantSummary } from './platform.service';
import { CreateTenantDto } from './dto/platform.dto';

/**
 * Platform-admin API (ADR-0009): správa všech firem napříč tenanty. Jen pro
 * `is_platform_admin` (JwtAuthGuard ověří identitu, PlatformAdminGuard flag).
 */
@Controller('platform')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class PlatformController {
  constructor(private readonly platform: PlatformService) {}

  @Get('tenants')
  listTenants(): Promise<TenantSummary[]> {
    return this.platform.listTenants();
  }

  @Post('tenants')
  createTenant(@Body() dto: CreateTenantDto): Promise<CreatedTenant> {
    return this.platform.createTenant(dto);
  }
}
