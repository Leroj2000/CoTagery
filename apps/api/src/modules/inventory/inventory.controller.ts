import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard, type RequestUser } from '../../core/auth/jwt-auth.guard';
import { CurrentUser } from '../../core/auth/decorators';
import { PermissionsGuard } from '../../core/rbac/permissions.guard';
import { RequirePermission } from '../../core/rbac/require-permission.decorator';
import { InventoryService, type InventoryDetail } from './inventory.service';
import { InventoryExportService } from './inventory-export.service';
import {
  ReconcileDto,
  RecordVehicleDto,
  ScanInventoryDto,
  StartInventoryDto,
  StartVehicleInventoryDto,
} from './dto/inventory.dto';
import type { InventoryCheck } from './entities/inventory-check.entity';
import type { InventoryScan } from './entities/inventory-scan.entity';

@Controller('inventory')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InventoryController {
  constructor(
    private readonly inventory: InventoryService,
    private readonly exports: InventoryExportService,
  ) {}

  @Get()
  @RequirePermission('asset.inventory.manage')
  list(): Promise<InventoryCheck[]> {
    return this.inventory.list();
  }

  @Post()
  @RequirePermission('asset.inventory.manage')
  start(@Body() dto: StartInventoryDto): Promise<InventoryCheck> {
    return this.inventory.start(dto);
  }

  /** Inventura vozidel – všechna vozidla nebo jedno, k období od–do. */
  @Post('vehicles')
  @RequirePermission('asset.inventory.manage')
  startVehicles(@Body() dto: StartVehicleInventoryDto): Promise<InventoryCheck> {
    return this.inventory.startVehicles(dto);
  }

  /** Zápis stavu tachometru / poznámky k vozidlu během inventury. */
  @Post(':id/vehicles/:assetId')
  @RequirePermission('asset.inventory.manage')
  recordVehicle(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @Body() dto: RecordVehicleDto,
  ): Promise<InventoryDetail> {
    return this.inventory.recordVehicle(id, assetId, dto);
  }

  /** Export inventury do Excelu (sloupce podle Nastavení → Exporty). */
  @Get(':id/export')
  @RequirePermission('asset.inventory.manage')
  async export(@Param('id', ParseUUIDPipe) id: string): Promise<StreamableFile> {
    const file = await this.exports.export(id);
    return new StreamableFile(file.buffer, {
      type: file.mime,
      disposition: `attachment; filename="${file.fileName}"`,
    });
  }

  @Get(':id')
  @RequirePermission('asset.inventory.manage')
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
