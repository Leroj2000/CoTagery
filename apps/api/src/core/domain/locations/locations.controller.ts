import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { RequirePermission } from '../../rbac/require-permission.decorator';
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import type { Location } from '../entities/location.entity';

@Controller('locations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get()
  list(): Promise<Location[]> {
    return this.locations.list();
  }

  @Post()
  @RequirePermission('core.location.create')
  create(@Body() dto: CreateLocationDto): Promise<Location> {
    return this.locations.create(dto);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<Location> {
    return this.locations.get(id);
  }

  @Patch(':id')
  @RequirePermission('core.location.create')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLocationDto): Promise<Location> {
    return this.locations.update(id, dto);
  }
}
