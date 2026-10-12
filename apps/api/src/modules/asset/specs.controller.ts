import { Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/rbac/permissions.guard';
import { RequirePermission } from '../../core/rbac/require-permission.decorator';
import { SpecsService, type FetchSpecResult } from './specs.service';
import type { AssetSpec } from './entities/asset-spec.entity';
import { RequireModule } from '../../core/rbac/require-module.decorator';

/** Technické specifikace položky „přes AI" (EPIC-19+). */
@Controller('assets/:id/specs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SpecsController {
  constructor(private readonly specs: SpecsService) {}

  @Get()
  @RequirePermission('asset.item.view')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<AssetSpec | null> {
    return this.specs.get(id);
  }

  @Post('fetch-ai')
  @RequireModule('ai')
  @RequirePermission('asset.media.manage')
  fetchAi(@Param('id', ParseUUIDPipe) id: string): Promise<FetchSpecResult> {
    return this.specs.fetchAi(id);
  }
}
