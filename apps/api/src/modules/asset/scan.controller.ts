import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, type RequestUser } from '../../core/auth/jwt-auth.guard';
import { CurrentUser } from '../../core/auth/decorators';
import { RolesGuard } from '../../core/rbac/roles.guard';
import { AssetService, type ScanResult } from './asset.service';

/**
 * Global Scan (interní skener): naskenovaný kód → věc + kontext + primární akce.
 * Rozpozná náš public_code i adoptovaný external_code (tenant kontext). Oddělené
 * od veřejného resolveru `/r/{code}`, který jede jen přes public_code.
 */
@Controller('scan')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ScanController {
  constructor(private readonly assets: AssetService) {}

  @Get()
  lookup(
    @Query('code') code: string,
    @CurrentUser() user: RequestUser | undefined,
  ): Promise<ScanResult> {
    return this.assets.scanLookup(code ?? '', user?.userId);
  }
}
