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
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { AllowAuthenticatedOnly, RequirePermission } from '../../rbac/require-permission.decorator';
import { DigitalObjectsService } from './digital-objects.service';
import { DataCarriersService } from '../carriers/data-carriers.service';
import { CreateDigitalObjectDto } from './dto/create-digital-object.dto';
import { UpdateDigitalObjectDto } from './dto/update-digital-object.dto';
import { AdoptCarrierDto, CreateDataCarrierDto } from '../carriers/dto/carrier.dto';
import type { DigitalObject } from '../entities/digital-object.entity';
import type { DataCarrier } from '../entities/data-carrier.entity';

@Controller('objects')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DigitalObjectsController {
  constructor(
    private readonly objects: DigitalObjectsService,
    private readonly carriers: DataCarriersService,
  ) {}

  @Get()
  @AllowAuthenticatedOnly()
  list(): Promise<DigitalObject[]> {
    return this.objects.list();
  }

  @Post()
  @RequirePermission('object.item.manage')
  create(@Body() dto: CreateDigitalObjectDto): Promise<DigitalObject> {
    return this.objects.create(dto);
  }

  @Get(':id')
  @AllowAuthenticatedOnly()
  get(@Param('id', ParseUUIDPipe) id: string): Promise<DigitalObject> {
    return this.objects.get(id);
  }

  @Patch(':id')
  @RequirePermission('object.item.manage')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDigitalObjectDto,
  ): Promise<DigitalObject> {
    return this.objects.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('object.item.manage')
  @HttpCode(204)
  archive(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.objects.archive(id);
  }

  @Get(':id/carriers')
  @AllowAuthenticatedOnly()
  listCarriers(@Param('id', ParseUUIDPipe) id: string): Promise<DataCarrier[]> {
    return this.carriers.listForObject(id);
  }

  @Post(':id/carriers')
  @RequirePermission('carrier.item.manage')
  addCarrier(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateDataCarrierDto,
  ): Promise<DataCarrier> {
    return this.carriers.createForObject(id, dto);
  }

  /** Adopce cizího kódu jako alias + vytvoření nativního carrieru (viz service). */
  @Post(':id/carriers/adopt')
  @RequirePermission('carrier.item.manage')
  adoptCarrier(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdoptCarrierDto,
  ): Promise<DataCarrier> {
    return this.carriers.adoptExternal(id, dto);
  }
}
