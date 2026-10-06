import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, type RequestUser } from '../../core/auth/jwt-auth.guard';
import { CurrentUser } from '../../core/auth/decorators';
import { PermissionsGuard } from '../../core/rbac/permissions.guard';
import { AllowAuthenticatedOnly, RequirePermission } from '../../core/rbac/require-permission.decorator';
import { InventoryService, type InventoryDetail } from './inventory.service';
import { ReconcileDto, ScanInventoryDto, StartInventoryDto } from './dto/inventory.dto';
import type { InventoryCheck } from './entities/inventory-check.entity';
import type { InventoryScan } from './entities/inventory-scan.entity';

@Controller('inventory')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  @AllowAuthenticatedOnly()
  list(): Promise<InventoryCheck[]> {
    return this.inventory.list();
  }

  @Post()
  @RequirePermission('asset.inventory.manage')
  start(@Body() dto: StartInventoryDto): Promise<InventoryCheck> {
    return this.inventory.start(dto);
  }

  @Get(':id')
  @AllowAuthenticatedOnly()
  detail(@Param('id', ParseUUIDPipe) id: string): Promise<InventoryDetail> {
    return this.inventory.detail(id);
  }

  @Post(':id/scan')
  @RequirePermission('asset.inventory.manage')
  scan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ScanInventoryDto,
    @CurrentUser() user: RequestUser | undefined,
  ): Promise<InventoryScan> {
    return this.inventory.scan(id, dto, user?.userId);
  }

  @Post(':id/reconcile')
  @RequirePermission('asset.inventory.manage')
  reconcile(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReconcileDto,
  ): Promise<InventoryDetail> {
    return this.inventory.reconcile(id, dto.assetId);
  }

  @Post(':id/close')
  @RequirePermission('asset.inventory.manage')
  close(@Param('id', ParseUUIDPipe) id: string): Promise<InventoryDetail> {
    return this.inventory.close(id);
  }
}
