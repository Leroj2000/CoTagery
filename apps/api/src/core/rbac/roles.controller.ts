import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { JwtAuthGuard, type RequestUser } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators';
import { PermissionsGuard } from './permissions.guard';
import { RequirePermission } from './require-permission.decorator';
import { RolesService, type RolesOverview } from './roles.service';

const ROLE_KEY = /^[a-z0-9_]{1,64}$/i;

class CreateRoleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  /** Nová role vznikne těsně pod touto rolí (a převezme její oprávnění, není-li zadáno jinak). */
  @IsString()
  @Matches(ROLE_KEY)
  belowRole!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  permissions?: string[];
}

class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsArray()
  @ArrayMaxSize(500)
  @IsString({ each: true })
  permissions!: string[];
}

/**
 * Role a oprávnění firmy. Čtení = `core.role.view`, změny = `core.role.manage`;
 * hierarchii a delegaci (jen role pod sebou, jen vlastní oprávnění) hlídá
 * RolesService.
 */
@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @RequirePermission('core.role.view')
  overview(@CurrentUser() user: RequestUser): Promise<RolesOverview> {
    return this.roles.overview(user);
  }

  @Post()
  @RequirePermission('core.role.manage')
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateRoleDto): Promise<RolesOverview> {
    return this.roles.create(user, dto);
  }

  @Put(':key')
  @RequirePermission('core.role.manage')
  update(
    @CurrentUser() user: RequestUser,
    @Param('key') key: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<RolesOverview> {
    return this.roles.update(user, key, dto);
  }

  @Post(':key/reset')
  @RequirePermission('core.role.manage')
  reset(@CurrentUser() user: RequestUser, @Param('key') key: string): Promise<RolesOverview> {
    return this.roles.reset(user, key);
  }

  @Delete(':key')
  @RequirePermission('core.role.manage')
  remove(@CurrentUser() user: RequestUser, @Param('key') key: string): Promise<RolesOverview> {
    return this.roles.remove(user, key);
  }
}
