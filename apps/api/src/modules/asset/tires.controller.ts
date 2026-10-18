import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/rbac/permissions.guard';
import { RequirePermission } from '../../core/rbac/require-permission.decorator';
import { CreateTireDto, MountTireSetDto, UpdateTireDto } from './dto/tire.dto';
import type { AssetTire } from './entities/asset-tire.entity';
import { TiresService } from './tires.service';

/** Pneumatiky položky (vozidla/stroje): sady × nápravy, přezutí. */
@Controller('assets/:id/tires')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TiresController {
  constructor(private readonly tires: TiresService) {}

  @Get()
  @RequirePermission('asset.item.view')
  list(@Param('id', ParseUUIDPipe) id: string): Promise<AssetTire[]> {
    return this.tires.list(id);
  }

  @Post()
  @RequirePermission('asset.item.update')
  create(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateTireDto): Promise<AssetTire> {
    return this.tires.create(id, dto);
  }

  @Post('mount')
  @RequirePermission('asset.item.update')
  mount(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MountTireSetDto,
  ): Promise<AssetTire[]> {
    return this.tires.mount(id, dto.setLabel);
  }

  @Patch(':tireId')
  @RequirePermission('asset.item.update')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tireId', ParseUUIDPipe) tireId: string,
    @Body() dto: UpdateTireDto,
  ): Promise<AssetTire> {
    return this.tires.update(id, tireId, dto);
  }

  @Delete(':tireId')
  @RequirePermission('asset.item.update')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tireId', ParseUUIDPipe) tireId: string,
  ): Promise<{ deleted: true }> {
    return this.tires.remove(id, tireId);
  }
}
