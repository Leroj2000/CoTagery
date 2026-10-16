import { HttpException } from '@nestjs/common';
import { z } from 'zod';
import type { ActionExecutorService } from '../actions/action-executor.service';
import { ActionRegistry } from '../actions/action-registry.service';
import { defineAction } from '../actions/channel-action';
import { McpServerService } from './mcp-server.service';
import { McpController } from './mcp.controller';
import type { McpTokenService } from './mcp-token.service';
import type { OAuthService } from '../oauth/oauth.service';

const actor = { userId: 'u', channel: 'mcp' as const, tenantId: 't', externalRef: 'tok' };

function setup() {
  const registry = new ActionRegistry({ actions: () => [] } as never);
  registry.register(
    defineAction({
      key: 'asset.search',
      title: 'Hledat',
      description: 'Search',
      input: z.object({ query: z.string() }),
      permission: 'asset.item.view',
      kind: 'read',
      requiresConfirmation: false,
      scope: 'tenant',
      execute: async () => ({}),
    }),
  );
  registry.register(
    defineAction({
      key: 'asset.create',
      title: 'Založit',
      description: 'Create',
      input: z.object({ name: z.string() }),
      permission: 'asset.item.create',
      kind: 'write',
      requiresConfirmation: true,
      scope: 'tenant',
      execute: async () => ({}),
    }),
  );
  const execute = jest.fn(async (_a: unknown, key: string, input: { query?: string }) =>
    input.query === 'deny'
      ? { ok: false as const, key, code: 'MISSING_PERMISSION' as const, message: 'Nemáš oprávnění' }
      : { ok: true as const, key, data: { total: 0, items: [] } },
  );
  const server = new McpServerService(registry, { execute } as unknown as ActionExecutorService);
  return { server, execute };
}

describe('McpServerService', () => {
  it('initialize vyjedná verzi protokolu', async () => {
    const { server } = setup();
    const r = (await server.handle(
      { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } },
      actor,
    )) as { result: { protocolVersion: string; capabilities: unknown } };
    expect(r.result.protocolVersion).toBe('2025-03-26');
    expect(r.result.capabilities).toEqual({ tools: { listChanged: false } });
  });

  it('notifikace vrací null (HTTP 202)', async () => {
    const { server } = setup();
    expect(
      await server.handle({ jsonrpc: '2.0', method: 'notifications/initialized' }, actor),
    ).toBeNull();
  });

  it('tools/list: názvy bez teček, schéma a anotace', async () => {
    const { server } = setup();
    const r = (await server.handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, actor)) as {
      result: {
        tools: { name: string; inputSchema: unknown; annotations: Record<string, boolean> }[];
      };
    };
    const [search, create] = r.result.tools;
    expect(search.name).toBe('asset_search');
    expect(search.inputSchema).toMatchObject({ type: 'object', required: ['query'] });
    expect(search.annotations.readOnlyHint).toBe(true);
    expect(create.annotations.destructiveHint).toBe(true);
  });

  it('tools/call jde přes executor s kanálem mcp', async () => {
    const { server, execute } = setup();
    const r = (await server.handle(
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'asset_search', arguments: { query: 'x' } },
      },
      actor,
    )) as { result: { isError: boolean } };
    expect(execute).toHaveBeenCalledWith(
      actor,
      'asset.search',
      { query: 'x' },
      { confirmed: true },
    );
    expect(r.result.isError).toBe(false);
  });

  it('chyba akce = isError, neznámý nástroj = -32602, neznámá metoda = -32601', async () => {
    const { server } = setup();
    const denied = (await server.handle(
      {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: { name: 'asset_search', arguments: { query: 'deny' } },
      },
      actor,
    )) as { result: { isError: boolean; content: { text: string }[] } };
    expect(denied.result.isError).toBe(true);
    expect(denied.result.content[0].text).toContain('MISSING_PERMISSION');
    const unknown = (await server.handle(
      { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'drop_db' } },
      actor,
    )) as { error: { code: number } };
    expect(unknown.error.code).toBe(-32602);
    const nomethod = (await server.handle({ jsonrpc: '2.0', id: 6, method: 'x' }, actor)) as {
      error: { code: number };
    };
    expect(nomethod.error.code).toBe(-32601);
  });
});

describe('McpController', () => {
  const res = () => {
    const r = { code: 200, headers: {} as Record<string, string> };
    return Object.assign(r, {
      status(c: number) {
        r.code = c;
        return this;
      },
      setHeader(n: string, v: string) {
        r.headers[n] = v;
      },
      end() {},
    });
  };

  it('bez platného tokenu 401, s tokenem předá aktéra s firmou tokenu', async () => {
    const { server, execute } = setup();
    const tokens = {
      verify: jest.fn(async (t: string) =>
        t === 'tgm_ok' ? { id: 'k', userId: 'u1', tenantId: 't1' } : null,
      ),
    } as unknown as McpTokenService;
    const oauth = {
      resourceMetadataUrl: () => 'https://t.example/.well-known/oauth-protected-resource/mcp',
      verifyAccessToken: jest.fn(async (t: string) =>
        t === 'tgo_ok' ? { grantId: 'g', userId: 'u2', tenantId: 't2' } : null,
      ),
    } as unknown as OAuthService;
    const ctrl = new McpController(server, tokens, { allow: async () => true } as never, oauth);
    const r1 = res();
    await expect(
      ctrl.post(undefined, { jsonrpc: '2.0', id: 1, method: 'ping' }, r1),
    ).rejects.toBeInstanceOf(HttpException);
    expect(r1.headers['WWW-Authenticate']).toContain('Bearer');
    await expect(
      ctrl.post('Bearer tgm_bad', { jsonrpc: '2.0', id: 1, method: 'ping' }, res()),
    ).rejects.toBeInstanceOf(HttpException);
    await ctrl.post(
      'Bearer tgm_ok',
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'asset_search', arguments: { query: 'a' } },
      },
      res(),
    );
    expect(execute).toHaveBeenCalledWith(
      { userId: 'u1', channel: 'mcp', tenantId: 't1', externalRef: 'k' },
      'asset.search',
      { query: 'a' },
      { confirmed: true },
    );
    const r2 = res();
    await ctrl.post('Bearer tgm_ok', { jsonrpc: '2.0', method: 'notifications/initialized' }, r2);
    expect(r2.code).toBe(202);
  });
});
