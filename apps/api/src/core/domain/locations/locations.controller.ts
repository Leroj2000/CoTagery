import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { RequirePermission } from '../../rbac/require-permission.decorator';
import {
  LocationsService,
  type CellAsset,
  type GridView,
} from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { GenerateGridDto } from './dto/grid.dto';
import type { Location } from '../entities/location.entity';

@Controller('locations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get()
  @RequirePermission('core.location.view')
  list(): Promise<Location[]> {
    return this.locations.list();
  }

  @Post()
  @RequirePermission('core.location.create')
  create(@Body() dto: CreateLocationDto): Promise<Location> {
    return this.locations.create(dto);
  }

  @Get(':id')
  @RequirePermission('core.location.view')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<Location> {
    return this.locations.get(id);
  }

  @Patch(':id')
  @RequirePermission('core.location.create')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLocationDto): Promise<Location> {
    return this.locations.update(id, dto);
  }

  @Get(':id/grid')
  @RequirePermission('core.location.view')
  grid(@Param('id', ParseUUIDPipe) id: string): Promise<GridView> {
    return this.locations.getGrid(id);
  }

  @Post(':id/grid')
  @RequirePermission('core.location.create')
  generateGrid(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GenerateGridDto,
  ): Promise<GridView> {
    return this.locations.generateGrid(id, dto);
  }

  @Get(':id/assets')
  @RequirePermission('core.location.view')
  cellAssets(@Param('id', ParseUUIDPipe) id: string): Promise<CellAsset[]> {
    return this.locations.cellAssets(id);
  }
}
