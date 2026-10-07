import { Body, Controller, Delete, Get, Param, Put, UseGuards } from '@nestjs/common';
import { IsArray, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { LabelTemplatesService, type LabelTemplatesView } from './label-templates.service';

class SaveLabelTemplateDto {
  /** Obsah buněk ověří sdílené `normalizeLabelCells` (typ, délky, duplicity). */
  @IsArray()
  cells!: unknown[];
}

class DefaultFormatDto {
  @IsString()
  @MaxLength(40)
  formatKey!: string;
}

/**
 * Šablony štítků. Čtení má každý, kdo tiskne štítky (`asset.item.view`);
 * úpravy jen správce nastavení firmy.
 */
@Controller('label-templates')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LabelTemplatesController {
  constructor(private readonly templates: LabelTemplatesService) {}

  @Get()
  @RequirePermission('asset.item.view')
  list(): Promise<LabelTemplatesView> {
    return this.templates.list();
  }

  @Put('default-format')
  @RequirePermission('core.organization.configure')
  setDefault(@Body() dto: DefaultFormatDto): Promise<LabelTemplatesView> {
    return this.templates.setDefaultFormat(dto.formatKey);
  }

  @Put(':formatKey')
  @RequirePermission('core.organization.configure')
  save(
    @Param('formatKey') formatKey: string,
    @Body() dto: SaveLabelTemplateDto,
  ): Promise<LabelTemplatesView> {
    return this.templates.save(formatKey, dto.cells);
  }

  @Delete(':formatKey')
  @RequirePermission('core.organization.configure')
  reset(@Param('formatKey') formatKey: string): Promise<LabelTemplatesView> {
    return this.templates.reset(formatKey);
  }
}
