import { NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { ActionExecutorService } from '../actions/action-executor.service';
import type { ActionResult } from '../actions/channel-action';
import type { ChannelIdentity, ChannelIdentityService } from '../identity/channel-identity.service';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramWebhookController } from './telegram.controller';
import type { InlineButton, TelegramApi, TelegramUpdate } from './telegram.types';

const USER = '11111111-1111-4111-8111-111111111111';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CONV = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const SECRET = 'test-secret-test-secret-123';

function setup(opts: { identity?: ChannelIdentity | null; memberships?: string[] } = {}) {
  const sent: { chatId: number; text: string; buttons?: InlineButton[][] }[] = [];
  const api: TelegramApi = {
    sendMessage: jest.fn(async (chatId, text, buttons) => {
      sent.push({ chatId, text, buttons });
    }),
    answerCallbackQuery: jest.fn(async () => undefined),
  };
  let identity: ChannelIdentity | null =
    opts.identity === undefined
      ? ({
          id: 'id-1',
          userId: USER,
          channel: 'telegram',
          externalId: '42',
          currentTenantId: A,
          displayName: null,
        } as ChannelIdentity)
      : opts.identity;
  const conversations = new Map<
    string,
    { tenantId: string | null; state: Record<string, unknown> }
  >();
  const processed = new Set<string>();
  const identities = {
    markProcessed: jest.fn(async (_c: string, k: string) => {
      if (processed.has(k)) return false;
      processed.add(k);
      return true;
    }),
    findActive: jest.fn(async () => identity),
    setTenant: jest.fn(async (_id: string, t: string | null) => {
      if (identity) identity = { ...identity, currentTenantId: t };
    }),
    revokeById: jest.fn(async () => {
      identity = null;
    }),
    consumeLinkCode: jest.fn(async (_ch: string, _ext: string, code: string) =>
      code === '123456' ? identity : null,
    ),
    saveConversation: jest.fn(
      async (_id: string, tenantId: string | null, state: Record<string, unknown>) => {
        conversations.set(CONV, { tenantId, state });
        return CONV;
      },
    ),
    takeConversation: jest.fn(async (_id: string, convId: string) => {
      const c = conversations.get(convId) ?? null;
      conversations.delete(convId);
      return c;
    }),
  } as unknown as ChannelIdentityService;
  const members = (opts.memberships ?? [A]).map((id) => ({
    membership_id: `m-${id}`,
    organization_id: id,
    organization_name: id === A ? 'Firma A' : 'Firma B',
    role: 'owner',
  }));
  const execute = jest.fn(
    async (
      actor: { tenantId: string | null },
      key: string,
      input: Record<string, unknown>,
      o?: { confirmed?: boolean },
    ): Promise<ActionResult> => {
      if (key === 'asset.create' && !o?.confirmed) {
        return {
          ok: false,
          key,
          code: 'CONFIRMATION_REQUIRED',
          message: 'potvrď',
          summary: `Založit položku „${String(input.name)}"`,
        };
      }
      if (key === 'asset.create') {
        return {
          ok: true,
          key,
          data: { id: 'x', name: input.name, status: 'available', url: 'https://w/assets/x' },
        };
      }
      if (key === 'asset.search') return { ok: true, key, data: { total: 0, items: [] } };
      return { ok: false, key, code: 'FAILED', message: `tenant ${actor.tenantId}` };
    },
  );
  const executor = {
    execute,
    memberships: jest.fn(async () => members),
  } as unknown as ActionExecutorService;
  const rate = { allow: jest.fn(async () => true) };
  const config = {
    get: (k: string) => (k === 'TELEGRAM_WEBHOOK_SECRET' ? SECRET : undefined),
  } as unknown as ConfigService;
  const bot = new TelegramBotService(api, identities, executor, rate as never, config);
  return { bot, sent, api, execute, identities, rate, config };
}

let seq = 1;
const msg = (text: string, chatId = 42, type: 'private' | 'group' = 'private'): TelegramUpdate => ({
  update_id: seq++,
  message: {
    message_id: 1,
    chat: { id: chatId, type },
    from: { id: chatId, first_name: 'Jan' },
    text,
  },
});
const cb = (data: string, chatId = 42): TelegramUpdate => ({
  update_id: seq++,
  callback_query: {
    id: 'q',
    from: { id: chatId },
    data,
    message: { message_id: 2, chat: { id: chatId, type: 'private' } },
  },
});

describe('TelegramBotService', () => {
  it('nepropojený chat dostane návod a nic se neprovede', async () => {
    const { bot, sent, execute } = setup({ identity: null });
    await bot.handleUpdate(msg('vrtačka'));
    expect(sent[0].text).toContain('není propojený');
    expect(execute).not.toHaveBeenCalled();
  });

  it('propojení kódem /start', async () => {
    const { bot, sent, identities } = setup();
    await bot.handleUpdate(msg('/start 123456'));
    expect(identities.consumeLinkCode).toHaveBeenCalledWith('telegram', '42', '123456', 'Jan');
    expect(sent[0].text).toContain('propojený s účtem Jan');
  });

  it('neplatný kód a rate limit propojování', async () => {
    const { bot, sent, rate } = setup();
    await bot.handleUpdate(msg('/start 999999'));
    expect(sent[0].text).toContain('neplatný');
    rate.allow.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await bot.handleUpdate(msg('/start 123456'));
    expect(sent[1].text).toContain('Příliš mnoho');
  });

  it('idempotence: stejné update_id se zpracuje jednou', async () => {
    const { bot, execute } = setup();
    const u = msg('vrtačka');
    await bot.handleUpdate(u);
    await bot.handleUpdate(u);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('text = hledání v aktuální firmě', async () => {
    const { bot, sent, execute } = setup();
    await bot.handleUpdate(msg('vrtačka'));
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: A, channel: 'telegram', userId: USER }),
      'asset.search',
      { query: 'vrtačka', limit: 5 },
    );
    expect(sent[0].text).toBe('Nic jsem nenašel.');
  });

  it('skupinové chaty odmítá', async () => {
    const { bot, sent, execute } = setup();
    await bot.handleUpdate(msg('vrtačka', -5, 'group'));
    expect(sent[0].text).toContain('soukromém');
    expect(execute).not.toHaveBeenCalled();
  });

  it('zápis vyžaduje potvrzení tlačítkem; Zrušit nic neprovede', async () => {
    const { bot, sent, execute } = setup();
    await bot.handleUpdate(msg('/zalozit Vrtačka'));
    expect(sent[0].text).toBe('Založit položku „Vrtačka"?');
    const [yes, no] = sent[0].buttons![0];
    expect(yes.callback_data).toMatch(/^c:cccc.*:y:/);
    expect(yes.callback_data.length).toBeLessThanOrEqual(64);
    await bot.handleUpdate(cb(no.callback_data));
    expect(sent[1].text).toBe('Zrušeno.');
    expect(execute.mock.calls.filter((c) => c[3]?.confirmed)).toHaveLength(0);
  });

  it('potvrzení provede akci s confirmed=true', async () => {
    const { bot, sent, execute } = setup();
    await bot.handleUpdate(msg('/zalozit Vrtačka'));
    await bot.handleUpdate(cb(sent[0].buttons![0][0].callback_data));
    expect(execute).toHaveBeenLastCalledWith(
      expect.objectContaining({ tenantId: A }),
      'asset.create',
      { name: 'Vrtačka' },
      { confirmed: true },
    );
    expect(sent[1].text).toContain('je založená');
    // druhé kliknutí už nic neprovede
    await bot.handleUpdate(cb(sent[0].buttons![0][0].callback_data));
    expect(sent[2].text).toContain('neplatí');
  });

  it('podvržený podpis callbacku je odmítnut', async () => {
    const { bot, sent, execute } = setup();
    await bot.handleUpdate(msg('/zalozit Vrtačka'));
    const forged = sent[0].buttons![0][0].callback_data.replace(/:[^:]+$/, ':AAAAAAAAAA');
    await bot.handleUpdate(cb(forged));
    expect(execute.mock.calls.filter((c) => c[3]?.confirmed)).toHaveLength(0);
  });

  it('draft z firmy A nejde potvrdit po přepnutí na firmu B', async () => {
    const { bot, sent, execute, identities } = setup({ memberships: [A, B] });
    await bot.handleUpdate(msg('/zalozit Vrtačka'));
    const yes = sent[0].buttons![0][0].callback_data;
    await identities.setTenant('id-1', B);
    await bot.handleUpdate(cb(yes));
    expect(sent[1].text).toContain('neplatí');
    expect(execute.mock.calls.filter((c) => c[3]?.confirmed)).toHaveLength(0);
  });

  it('výběr firmy tlačítkem; ztracené členství firmu zruší', async () => {
    const { bot, sent, identities } = setup({ memberships: [A, B] });
    await bot.handleUpdate(msg('/firmy'));
    expect(sent[0].buttons!.map((r) => r[0].text)).toEqual(['✓ Firma A', 'Firma B']);
    await bot.handleUpdate(cb(sent[0].buttons![1][0].callback_data));
    expect(identities.setTenant).toHaveBeenLastCalledWith('id-1', B);
    expect(sent[1].text).toBe('Pracuješ ve firmě Firma B.');
  });

  it('bez platné firmy nabídne výběr místo akce', async () => {
    const { bot, sent, execute } = setup({
      memberships: [B, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'],
    });
    await bot.handleUpdate(msg('vrtačka'));
    expect(execute).not.toHaveBeenCalled();
    expect(sent[0].text).toBe('Vyber firmu:');
  });

  it('/odpojit zruší identitu', async () => {
    const { bot, sent, identities } = setup();
    await bot.handleUpdate(msg('/odpojit'));
    expect(identities.revokeById).toHaveBeenCalledWith('id-1');
    expect(sent[0].text).toContain('odpojen');
  });
});

describe('TelegramWebhookController', () => {
  it('ověřuje secret v cestě i hlavičce', async () => {
    const { bot, config } = setup();
    const handle = jest.spyOn(bot, 'handleUpdate').mockResolvedValue();
    const ctrl = new TelegramWebhookController(bot, config);
    await expect(ctrl.webhook('spatne', SECRET, msg('x'))).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(ctrl.webhook(SECRET, undefined, msg('x'))).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(ctrl.webhook(SECRET, SECRET, msg('x'))).resolves.toEqual({ ok: true });
    expect(handle).toHaveBeenCalledTimes(1);
  });

  it('bez nastaveného secretu je vypnutý', async () => {
    const { bot } = setup();
    const ctrl = new TelegramWebhookController(bot, { get: () => undefined } as never);
    await expect(ctrl.webhook('', '', msg('x'))).rejects.toBeInstanceOf(NotFoundException);
  });
});
