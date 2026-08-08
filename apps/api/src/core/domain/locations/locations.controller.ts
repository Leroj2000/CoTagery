import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import type { Location } from '../entities/location.entity';

@Controller('locations')
@UseGuards(JwtAuthGuard)
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get()
  list(): Promise<Location[]> {
    return this.locations.list();
  }

  @Post()
  create(@Body() dto: CreateLocationDto): Promise<Location> {
    return this.locations.create(dto);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<Location> {
    return this.locations.get(id);
  }
}
