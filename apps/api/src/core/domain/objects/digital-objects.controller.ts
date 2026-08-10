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
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard, RequireRole } from '../../rbac/roles.guard';
import { DigitalObjectsService } from './digital-objects.service';
import { DataCarriersService } from '../carriers/data-carriers.service';
import { CreateDigitalObjectDto } from './dto/create-digital-object.dto';
import { UpdateDigitalObjectDto } from './dto/update-digital-object.dto';
import { CreateDataCarrierDto } from '../carriers/dto/carrier.dto';
import type { DigitalObject } from '../entities/digital-object.entity';
import type { DataCarrier } from '../entities/data-carrier.entity';

@Controller('objects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DigitalObjectsController {
  constructor(
    private readonly objects: DigitalObjectsService,
    private readonly carriers: DataCarriersService,
  ) {}

  @Get()
  list(): Promise<DigitalObject[]> {
    return this.objects.list();
  }

  @Post()
  @RequireRole('EDITOR')
  create(@Body() dto: CreateDigitalObjectDto): Promise<DigitalObject> {
    return this.objects.create(dto);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<DigitalObject> {
    return this.objects.get(id);
  }

  @Patch(':id')
  @RequireRole('EDITOR')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDigitalObjectDto,
  ): Promise<DigitalObject> {
    return this.objects.update(id, dto);
  }

  @Delete(':id')
  @RequireRole('EDITOR')
  @HttpCode(204)
  archive(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.objects.archive(id);
  }

  @Get(':id/carriers')
  listCarriers(@Param('id', ParseUUIDPipe) id: string): Promise<DataCarrier[]> {
    return this.carriers.listForObject(id);
  }

  @Post(':id/carriers')
  @RequireRole('EDITOR')
  addCarrier(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateDataCarrierDto,
  ): Promise<DataCarrier> {
    return this.carriers.createForObject(id, dto);
  }
}
