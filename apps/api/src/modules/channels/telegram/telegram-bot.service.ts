import { createHmac, timingSafeEqual } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RateLimitService } from '../../../core/resolver/rate-limit.service';
import { ActionExecutorService } from '../actions/action-executor.service';
import type { ActionResult } from '../actions/channel-action';
import type { AssetCard } from '../actions/v1.actions';
import type { ChannelActor } from '../channel.types';
import { ChannelIdentityService, type ChannelIdentity } from '../identity/channel-identity.service';
import { STATUS_CS, T } from './telegram.texts';
import {
  TELEGRAM_API,
  type TelegramApi,
  type TelegramCallbackQuery,
  type TelegramMessage,
  type TelegramUpdate,
} from './telegram.types';

type ConversationState =
  | { type: 'confirm'; key: string; input: Record<string, unknown> }
  | { type: 'select_org'; options: string[] };

/**
 * Telegram adaptér (spec §5). Tenká vrstva: ověří identitu, vybere firmu z
 * aktivních členství a volá ActionExecutor. Zápisy jen přes potvrzovací
 * tlačítko; callback data nesou jen id konverzace + volbu + HMAC (§8.5).
 */
@Injectable()
export class TelegramBotService {
  private readonly logger = new Logger(TelegramBotService.name);

  constructor(
    @Inject(TELEGRAM_API) private readonly api: TelegramApi,
    private readonly identities: ChannelIdentityService,
    private readonly executor: ActionExecutorService,
    private readonly rateLimit: RateLimitService,
    private readonly config: ConfigService,
  ) {}

  private signingKey(): string {
    return (
      this.config.get<string>('TELEGRAM_WEBHOOK_SECRET') ??
      this.config.get<string>('JWT_SECRET') ??
      'tagery-dev'
    );
  }

  /** Podpis callback dat (konverzace + volba), 10 znaků base64url. */
  sign(conversationId: string, choice: string): string {
    return createHmac('sha256', this.signingKey())
      .update(`${conversationId}:${choice}`)
      .digest('base64url')
      .slice(0, 10);
  }

  callbackData(conversationId: string, choice: string): string {
    return `c:${conversationId}:${choice}:${this.sign(conversationId, choice)}`;
  }

  parseCallback(data: string | undefined): { conversationId: string; choice: string } | null {
    const m = /^c:([0-9a-f-]{36}):([a-z0-9]{1,3}):([A-Za-z0-9_-]{10})$/.exec(data ?? '');
    if (!m) return null;
    const expected = Buffer.from(this.sign(m[1], m[2]));
    const given = Buffer.from(m[3]);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    return { conversationId: m[1], choice: m[2] };
  }

  async handleUpdate(update: TelegramUpdate): Promise<void> {
    if (typeof update?.update_id !== 'number') return;
    if (!(await this.identities.markProcessed('telegram', String(update.update_id)))) return;
    try {
      if (update.callback_query) await this.onCallback(update.callback_query);
      else if (update.message) await this.onMessage(update.message);
    } catch (err) {
      this.logger.error(`Zpracování Telegram update selhalo: ${(err as Error).message}`);
    }
  }

  private actor(identity: ChannelIdentity, tenantId: string | null): ChannelActor {
    return {
      userId: identity.userId,
      channel: 'telegram',
      tenantId,
      externalRef: identity.externalId,
    };
  }

  /** Firma identity – jen z aktivních členství; jediné členství se vybere samo. */
  private async resolveTenant(identity: ChannelIdentity): Promise<string | null> {
    const memberships = await this.executor.memberships(identity.userId);
    if (
      identity.currentTenantId &&
      memberships.some((m) => m.organization_id === identity.currentTenantId)
    ) {
      return identity.currentTenantId;
    }
    const next = memberships.length === 1 ? memberships[0].organization_id : null;
    if (next !== identity.currentTenantId) await this.identities.setTenant(identity.id, next);
    return next;
  }

  private async onMessage(message: TelegramMessage): Promise<void> {
    const chatId = message.chat.id;
    if (message.chat.type !== 'private') {
      await this.api.sendMessage(chatId, T.groupsUnsupported);
      return;
    }
    if (!(await this.rateLimit.allow(`tg:chat:${chatId}`, 30, 60))) return;
    const text = (message.text ?? '').trim();
    const [rawCommand, ...rest] = text.split(/\s+/);
    const command = rawCommand.startsWith('/') ? rawCommand.split('@')[0].toLowerCase() : '';
    const arg = command ? rest.join(' ').trim() : text;

    if (command === '/start' && arg) {
      await this.link(chatId, arg, message);
      return;
    }

    const identity = await this.identities.findActive('telegram', String(chatId));
    if (!identity) {
      await this.api.sendMessage(chatId, T.notLinked);
      return;
    }

    switch (command) {
      case '/start':
      case '/pomoc':
      case '/help':
        await this.api.sendMessage(chatId, T.help);
        return;
      case '/odpojit':
        await this.identities.revokeById(identity.id);
        await this.api.sendMessage(chatId, T.unlinked);
        return;
      case '/firmy':
        await this.chooseOrg(chatId, identity);
        return;
    }

    const tenantId = await this.resolveTenant(identity);
    if (!tenantId) {
      await this.chooseOrg(chatId, identity);
      return;
    }
    const actor = this.actor(identity, tenantId);

    if (command === '/pozornost') {
      await this.reply(chatId, await this.executor.execute(actor, 'attention.list', {}));
      return;
    }
    if (command === '/zalozit') {
      if (!arg) {
        await this.api.sendMessage(chatId, T.needName);
        return;
      }
      await this.proposeWrite(chatId, identity, tenantId, 'asset.create', {
        name: arg.slice(0, 200),
      });
      return;
    }
    if (command === '/hledat' || !command) {
      if (!arg) {
        await this.api.sendMessage(chatId, T.needQuery);
        return;
      }
      await this.reply(
        chatId,
        await this.executor.execute(actor, 'asset.search', { query: arg.slice(0, 200), limit: 5 }),
      );
      return;
    }
    await this.api.sendMessage(chatId, T.help);
  }

  private async link(chatId: number, code: string, message: TelegramMessage): Promise<void> {
    if (!(await this.rateLimit.allow(`tg:link:${chatId}`, 5, 600))) {
      await this.api.sendMessage(chatId, T.tooMany);
      return;
    }
    const name =
      [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ') ||
      message.from?.username ||
      null;
    const identity = await this.identities.consumeLinkCode(
      'telegram',
      String(chatId),
      code.trim(),
      name,
    );
    if (!identity) {
      await this.api.sendMessage(chatId, T.badCode);
      return;
    }
    await this.api.sendMessage(chatId, `${T.linked(name ?? 'Tagery')}\n\n${T.help}`);
    if (!identity.currentTenantId) await this.chooseOrg(chatId, identity);
  }

  private async chooseOrg(chatId: number, identity: ChannelIdentity): Promise<void> {
    const memberships = await this.executor.memberships(identity.userId);
    if (memberships.length === 0) {
      await this.api.sendMessage(chatId, T.noOrgs);
      return;
    }
    const options = memberships.slice(0, 20).map((m) => m.organization_id);
    const conversationId = await this.identities.saveConversation(identity.id, null, {
      type: 'select_org',
      options,
    } satisfies ConversationState);
    await this.api.sendMessage(
      chatId,
      T.chooseOrg,
      memberships.slice(0, 20).map((m, i) => [
        {
          text: `${m.organization_id === identity.currentTenantId ? '✓ ' : ''}${m.organization_name}`,
          callback_data: this.callbackData(conversationId, String(i)),
        },
      ]),
    );
  }

  /** Zápis: nejdřív ověření (bez provedení), pak dotaz s tlačítky. */
  private async proposeWrite(
    chatId: number,
    identity: ChannelIdentity,
    tenantId: string,
    key: string,
    input: Record<string, unknown>,
  ): Promise<void> {
    const check = await this.executor.execute(this.actor(identity, tenantId), key, input);
    if (check.ok || check.code !== 'CONFIRMATION_REQUIRED') {
      await this.reply(chatId, check);
      return;
    }
    const conversationId = await this.identities.saveConversation(identity.id, tenantId, {
      type: 'confirm',
      key,
      input,
    } satisfies ConversationState);
    await this.api.sendMessage(chatId, T.confirm(check.summary ?? key), [
      [
        { text: T.confirmYes, callback_data: this.callbackData(conversationId, 'y') },
        { text: T.confirmNo, callback_data: this.callbackData(conversationId, 'n') },
      ],
    ]);
  }

  private async onCallback(query: TelegramCallbackQuery): Promise<void> {
    const chatId = query.message?.chat.id ?? query.from.id;
    const parsed = this.parseCallback(query.data);
    const identity = await this.identities.findActive('telegram', String(chatId));
    if (!parsed || !identity) {
      await this.api.answerCallbackQuery(query.id, identity ? T.expired : T.notLinked);
      return;
    }
    const conversation = await this.identities.takeConversation(identity.id, parsed.conversationId);
    await this.api.answerCallbackQuery(query.id);
    if (!conversation) {
      await this.api.sendMessage(chatId, T.expired);
      return;
    }
    const state = conversation.state as unknown as ConversationState;

    if (state.type === 'select_org') {
      const tenantId = state.options[Number(parsed.choice)];
      const memberships = await this.executor.memberships(identity.userId);
      const chosen = memberships.find((m) => m.organization_id === tenantId);
      if (!chosen) {
        await this.api.sendMessage(chatId, T.expired);
        return;
      }
      await this.identities.setTenant(identity.id, chosen.organization_id);
      await this.api.sendMessage(chatId, T.orgSelected(chosen.organization_name));
      return;
    }

    if (parsed.choice !== 'y') {
      await this.api.sendMessage(chatId, T.cancelled);
      return;
    }
    // Draft z firmy A nelze potvrdit ve firmě B (§8.6); členství se ověří znovu.
    const tenantId = await this.resolveTenant(identity);
    if (!tenantId || tenantId !== conversation.tenantId) {
      await this.api.sendMessage(chatId, T.expired);
      return;
    }
    const result = await this.executor.execute(
      this.actor(identity, tenantId),
      state.key,
      state.input,
      { confirmed: true },
    );
    await this.reply(chatId, result);
  }

  /** Převede výsledek akce na zprávu. */
  private async reply(chatId: number, result: ActionResult): Promise<void> {
    if (!result.ok) {
      if (result.code === 'NO_ORGANIZATION') await this.api.sendMessage(chatId, T.needOrg);
      else await this.api.sendMessage(chatId, result.message);
      return;
    }
    await this.api.sendMessage(chatId, formatResult(result.key, result.data));
  }
}

function cardLine(c: AssetCard): string {
  const extra = [
    STATUS_CS[c.status] ?? c.status,
    c.location,
    c.registrationPlate,
    c.inventoryNumber,
  ].filter(Boolean);
  return `• ${c.name} (${extra.join(', ')})\n  ${c.url}`;
}

export function formatResult(key: string, data: unknown): string {
  switch (key) {
    case 'asset.search': {
      const d = data as { total: number; items: AssetCard[] };
      if (d.items.length === 0) return T.nothingFound;
      const more = d.total > d.items.length ? `\n… a dalších ${d.total - d.items.length}` : '';
      return `Nalezeno ${d.total}:\n${d.items.map(cardLine).join('\n')}${more}`;
    }
    case 'asset.create':
    case 'asset.move': {
      const c = data as AssetCard;
      return key === 'asset.create' ? T.created(c.name, c.url) : `Přesunuto.\n${cardLine(c)}`;
    }
    case 'attention.list': {
      const d = data as {
        overdueCount: number;
        pendingConfirmationsCount: number;
        openIssuesCount: number;
        dueServicesCount: number;
        overdue: (AssetCard & { dueAt: string | null })[];
      };
      const lines = [
        `Po termínu vrácení: ${d.overdueCount}`,
        ...d.overdue.slice(0, 5).map(cardLine),
        `Nepotvrzená převzetí: ${d.pendingConfirmationsCount}`,
        `Otevřené závady: ${d.openIssuesCount}`,
        `Servis do 30 dní: ${d.dueServicesCount}`,
      ];
      return lines.join('\n');
    }
    default:
      return 'Hotovo.';
  }
}
