import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/rbac/permissions.guard';
import { RequirePermission } from '../../core/rbac/require-permission.decorator';
import { UtilizationService, type UtilizationReport } from './utilization.service';

/** Report vytíženosti (BACKLOG ZAK-03): co dokoupit, co leží a dá se prodat. */
@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UtilizationController {
  constructor(private readonly utilization: UtilizationService) {}

  @Get('utilization')
  @RequirePermission('asset.item.view')
  report(@Query('days') days?: string): Promise<UtilizationReport> {
    const n = Number(days);
    return this.utilization.report(Number.isInteger(n) && n >= 7 && n <= 365 ? n : 90);
  }
}
