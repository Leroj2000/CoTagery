import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/rbac/permissions.guard';
import { RequirePermission } from '../../core/rbac/require-permission.decorator';
import { MaintenanceService } from './maintenance.service';
import {
  AddMeterReadingDto,
  CompleteMaintenanceDto,
  UpdateMaintenanceRuleDto,
} from './dto/maintenance.dto';

@Controller('maintenance')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Get('due')
  @RequirePermission('asset.item.view')
  due() {
    return this.maintenance.due();
  }

  @Get('assets/:assetId')
  @RequirePermission('asset.item.view')
  summary(@Param('assetId', ParseUUIDPipe) assetId: string) {
    return this.maintenance.summary(assetId);
  }

  @Post('assets/:assetId/readings')
  @RequirePermission('asset.item.update')
  addReading(@Param('assetId', ParseUUIDPipe) assetId: string, @Body() dto: AddMeterReadingDto) {
    return this.maintenance.addReading(assetId, dto);
  }

  @Delete('assets/:assetId/readings/:readingId')
  @RequirePermission('asset.item.update')
  @HttpCode(204)
  deleteReading(
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @Param('readingId', ParseUUIDPipe) readingId: string,
  ) {
    return this.maintenance.deleteReading(assetId, readingId);
  }

  @Patch('assets/:assetId/rules/:code')
  @RequirePermission('asset.item.update')
  updateRule(
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @Param('code') code: string,
    @Body() dto: UpdateMaintenanceRuleDto,
  ) {
    return this.maintenance.updateRule(assetId, code, dto);
  }

  @Post('assets/:assetId/services')
  @RequirePermission('asset.item.update')
  complete(@Param('assetId', ParseUUIDPipe) assetId: string, @Body() dto: CompleteMaintenanceDto) {
    return this.maintenance.complete(assetId, dto);
  }
}
