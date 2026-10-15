import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CurrentUser } from '../../core/auth/decorators';
import { JwtAuthGuard, type RequestUser } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/rbac/permissions.guard';
import { AllowAuthenticatedOnly } from '../../core/rbac/require-permission.decorator';
import { ChannelIdentityService } from './identity/channel-identity.service';

/**
 * Propojení kanálů z webu (Profil → Propojené kanály). Jde o vlastní účet
 * přihlášeného uživatele – stačí autentizace; data firem se tu nevracejí.
 */
@Controller('channels')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ChannelsController {
  constructor(
    private readonly identities: ChannelIdentityService,
    private readonly config: ConfigService,
  ) {}

  @Post('telegram/link-code')
  @AllowAuthenticatedOnly()
  async telegramLinkCode(
    @CurrentUser() user: RequestUser,
  ): Promise<{ code: string; expiresAt: string; deepLink: string | null }> {
    const { code, expiresAt } = await this.identities.createLinkCode(user.userId, 'telegram');
    const bot = this.config.get<string>('TELEGRAM_BOT_USERNAME');
    return {
      code,
      expiresAt: expiresAt.toISOString(),
      deepLink: bot ? `https://t.me/${bot}?start=${code}` : null,
    };
  }

  @Get('identities')
  @AllowAuthenticatedOnly()
  identitiesList(@CurrentUser() user: RequestUser) {
    return this.identities.listForUser(user.userId);
  }

  @Delete('identities/:id')
  @AllowAuthenticatedOnly()
  @HttpCode(204)
  async revoke(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.identities.revokeForUser(user.userId, id);
  }
}
