import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ScanDto } from './dto/scan.dto';
import { JwtAuthGuard, type RequestUser } from '../../core/auth/jwt-auth.guard';
import { CurrentUser } from '../../core/auth/decorators';
import { PermissionsGuard } from '../../core/rbac/permissions.guard';
import { RequirePermission } from '../../core/rbac/require-permission.decorator';
import { AssetService, type ScanResult } from './asset.service';

/**
 * Global Scan (interní skener): naskenovaný kód → věc + kontext + primární akce.
 * Rozpozná náš public_code i adoptovaný external_code (tenant kontext). Oddělené
 * od veřejného resolveru `/r/{code}`, který jede jen přes public_code.
 */
@Controller('scan')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ScanController {
  constructor(private readonly assets: AssetService) {}

  @Post()
  @RequirePermission('asset.scan.use')
  capture(@Body() dto: ScanDto, @CurrentUser() user: RequestUser): Promise<ScanResult> {
    const { code, ...context } = dto;
    return this.assets.scanLookup(code, user.userId, context);
  }

  @Get()
  @RequirePermission('asset.scan.use')
  lookup(
    @Query('code') code: string,
    @CurrentUser() user: RequestUser | undefined,
  ): Promise<ScanResult> {
    return this.assets.scanLookup(code ?? '', user?.userId);
  }
}
