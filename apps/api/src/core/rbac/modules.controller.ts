import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from './permissions.guard';
import { RequirePermission } from './require-permission.decorator';
import { ModulesService, type ModuleState } from './modules.service';

class SetModuleDto {
  @IsIn(['active', 'inactive'])
  state!: 'active' | 'inactive';
}

/** Entitlementy modulů organizace (EPIC-18 Fáze 3). */
@Controller('modules')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ModulesController {
  constructor(private readonly modules: ModulesService) {}

  /** Řízené moduly + stav pro aktivní org (čte kdokoli přihlášený – pro skrytí v navigaci). */
  @Get()
  list(): Promise<ModuleState[]> {
    return this.modules.list();
  }

  @Patch(':key')
  @RequirePermission('core.module.configure')
  setState(@Param('key') key: string, @Body() dto: SetModuleDto): Promise<ModuleState> {
    return this.modules.setState(key, dto.state);
  }
}
