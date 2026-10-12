import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { RequirePermission } from '../../rbac/require-permission.decorator';
import { LocationTypesService, type LocationTypeView } from './location-types.service';

const KEY = /^[a-z][a-z0-9_]{1,40}$/;

class CreateLocationTypeDto {
  @IsString()
  @MaxLength(60)
  name!: string;

  @IsIn(['place', 'storage'])
  category!: 'place' | 'storage';

  @IsOptional()
  @IsBoolean()
  grid?: boolean;
}

class UpdateLocationTypeDto {
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(60)
  name?: string | null;

  @IsOptional()
  @IsIn(['place', 'storage'])
  category?: 'place' | 'storage';

  @IsOptional()
  @IsBoolean()
  grid?: boolean;

  @IsOptional()
  @IsBoolean()
  hidden?: boolean;

  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsInt()
  sortOrder?: number | null;
}

/** Typy míst firmy (číselník): čtení pro výběr typu, správa s `core.location.update`. */
@Controller('location-types')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LocationTypesController {
  constructor(private readonly types: LocationTypesService) {}

  @Get()
  @RequirePermission('core.location.view')
  list(): Promise<LocationTypeView[]> {
    return this.types.list();
  }

  @Post()
  @RequirePermission('core.location.update')
  create(@Body() dto: CreateLocationTypeDto): Promise<LocationTypeView[]> {
    return this.types.create(dto);
  }

  @Patch(':key')
  @RequirePermission('core.location.update')
  update(
    @Param('key') key: string,
    @Body() dto: UpdateLocationTypeDto,
  ): Promise<LocationTypeView[]> {
    if (!KEY.test(key)) throw new BadRequestException('Neplatný klíč typu');
    return this.types.update(key, dto);
  }

  @Delete(':key')
  @RequirePermission('core.location.update')
  remove(@Param('key') key: string): Promise<LocationTypeView[]> {
    if (!KEY.test(key)) throw new BadRequestException('Neplatný klíč typu');
    return this.types.remove(key);
  }
}
