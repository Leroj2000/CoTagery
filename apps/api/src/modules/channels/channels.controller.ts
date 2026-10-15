import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { CurrentUser } from '../../core/auth/decorators';
import { JwtAuthGuard, type RequestUser } from '../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../core/rbac/permissions.guard';
import { AllowAuthenticatedOnly } from '../../core/rbac/require-permission.decorator';
import { ActionExecutorService } from './actions/action-executor.service';
import { ChannelIdentityService } from './identity/channel-identity.service';
import { McpTokenService } from './mcp/mcp-token.service';

const createMcpTokenSchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  expiresInDays: z.number().int().min(1).max(365).nullable().default(90),
});

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
    private readonly mcpTokens: McpTokenService,
    private readonly executor: ActionExecutorService,
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

  // --- MCP osobní tokeny (dočasně místo OAuth) ---

  @Post('mcp-tokens')
  @AllowAuthenticatedOnly()
  async createMcpToken(@CurrentUser() user: RequestUser, @Body() body: unknown) {
    const parsed = createMcpTokenSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const { tenantId, name, expiresInDays } = parsed.data;
    const memberships = await this.executor.memberships(user.userId);
    if (!memberships.some((m) => m.organization_id === tenantId)) {
      throw new ForbiddenException('Nejsi aktivním členem této firmy');
    }
    // Token se zobrazí jen jednou; v DB je jen hash.
    return this.mcpTokens.create(user.userId, tenantId, name, expiresInDays);
  }

  @Get('mcp-tokens')
  @AllowAuthenticatedOnly()
  listMcpTokens(@CurrentUser() user: RequestUser) {
    return this.mcpTokens.listForUser(user.userId);
  }

  @Delete('mcp-tokens/:id')
  @AllowAuthenticatedOnly()
  @HttpCode(204)
  async revokeMcpToken(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.mcpTokens.revokeForUser(user.userId, id);
  }
}
