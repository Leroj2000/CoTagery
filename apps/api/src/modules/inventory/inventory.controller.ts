import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { RolesGuard, RequireRole } from '../../core/rbac/roles.guard';
import { InventoryService, type InventoryDetail } from './inventory.service';
import { ScanInventoryDto, StartInventoryDto } from './dto/inventory.dto';
import type { InventoryCheck } from './entities/inventory-check.entity';
import type { InventoryScan } from './entities/inventory-scan.entity';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  list(): Promise<InventoryCheck[]> {
    return this.inventory.list();
  }

  @Post()
  @RequireRole('EDITOR')
  start(@Body() dto: StartInventoryDto): Promise<InventoryCheck> {
    return this.inventory.start(dto);
  }

  @Get(':id')
  detail(@Param('id', ParseUUIDPipe) id: string): Promise<InventoryDetail> {
    return this.inventory.detail(id);
  }

  @Post(':id/scan')
  @RequireRole('EDITOR')
  scan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ScanInventoryDto,
  ): Promise<InventoryScan> {
    return this.inventory.scan(id, dto);
  }

  @Post(':id/close')
  @RequireRole('EDITOR')
  close(@Param('id', ParseUUIDPipe) id: string): Promise<InventoryDetail> {
    return this.inventory.close(id);
  }
}
