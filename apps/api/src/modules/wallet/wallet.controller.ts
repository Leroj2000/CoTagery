import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/rbac/permissions.guard';
import { RequirePermission } from '../../core/rbac/require-permission.decorator';
import { WalletService, type WalletView } from './wallet.service';
import { CreateWalletCodeDto } from './dto/wallet.dto';
import type { WalletCode } from './entities/wallet-code.entity';

/**
 * Klíčenka – osobní kódy uživatele + celofiremní sdílené (jen admin) + agregace
 * z modulů (read-only). Osobní operace může každý přihlášený; celofiremní kódy
 * spravuje jen `core.organization.configure`.
 */
@Controller('wallet')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get()
  list(): Promise<WalletView> {
    return this.wallet.list();
  }

  @Post('codes')
  createPersonal(@Body() dto: CreateWalletCodeDto): Promise<WalletCode> {
    return this.wallet.create(dto, false);
  }

  @Delete('codes/:id')
  deletePersonal(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.wallet.deletePersonal(id);
  }

  @Post('shared')
  @RequirePermission('core.organization.configure')
  createShared(@Body() dto: CreateWalletCodeDto): Promise<WalletCode> {
    return this.wallet.create(dto, true);
  }

  @Delete('shared/:id')
  @RequirePermission('core.organization.configure')
  deleteShared(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.wallet.deleteShared(id);
  }
}
