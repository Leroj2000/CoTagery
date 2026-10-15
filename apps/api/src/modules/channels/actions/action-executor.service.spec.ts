import { NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { ActionExecutorService } from './action-executor.service';
import { ActionRegistry } from './action-registry.service';
import { defineAction } from './channel-action';

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const TENANT_B = '22222222-2222-4222-8222-222222222222';

function setup(opts: {
  memberships?: { organization_id: string; role?: string }[];
  moduleActive?: boolean;
  allowed?: boolean;
  blocked?: string | null;
  scopeRows?: unknown[];
}) {
  const executed: unknown[] = [];
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const registry = new ActionRegistry({ actions: () => [] } as never);
  registry.register(
    defineAction({
      key: 'test.read',
      title: 'Čtení',
      description: 'read',
      input: z.object({ q: z.string().min(1) }),
      permission: 'asset.item.view',
      kind: 'read',
      requiresConfirmation: false,
      scope: 'tenant',
      execute: async (_ctx, input) => {
        executed.push(input);
        return { echo: input.q };
      },
    }),
  );
  registry.register(
    defineAction({
      key: 'test.write',
      title: 'Zápis',
      description: 'write',
      input: z.object({}),
      permission: 'asset.item.create',
      kind: 'write',
      requiresConfirmation: true,
      scope: 'tenant',
      summarize: () => 'Shrnutí zápisu',
      execute: async () => {
        executed.push('write');
        return { done: true };
      },
    }),
  );
  registry.register(
    defineAction({
      key: 'test.notfound',
      title: 'Nenalezeno',
      description: 'x',
      input: z.object({}),
      permission: null,
      kind: 'read',
      requiresConfirmation: false,
      scope: 'tenant',
      execute: async () => {
        throw new NotFoundException('Položka neexistuje');
      },
    }),
  );
  const dataSource = {
    query: jest.fn().mockResolvedValue(
      (opts.memberships ?? [{ organization_id: TENANT_A }]).map((m) => ({
        membership_id: `m-${m.organization_id}`,
        organization_id: m.organization_id,
        organization_name: 'Firma',
        role: m.role ?? 'EDITOR',
      })),
    ),
  };
  const manager = {
    query: jest
      .fn()
      .mockResolvedValue(opts.scopeRows ?? [{ scope_type: 'ORGANIZATION', scope_ref: null }]),
  };
  const context = {
    runInTenant: jest.fn(async (_t: string, fn: () => Promise<unknown>) => fn()),
    manager,
    setScope: jest.fn(),
    setActor: jest.fn(),
  };
  const authz = {
    isModuleActive: jest.fn().mockResolvedValue(opts.moduleActive ?? true),
    can: jest.fn().mockResolvedValue({
      allowed: opts.allowed ?? true,
      reasonCode: opts.allowed === false ? 'MISSING_PERMISSION' : 'ALLOWED',
    }),
  };
  const policy = { blockedReason: jest.fn().mockResolvedValue(opts.blocked ?? null) };
  const config = { get: () => 'https://app.example' };
  const exec = new ActionExecutorService(
    dataSource as never,
    registry,
    context as never,
    authz as never,
    policy as never,
    audit as never,
    config as never,
  );
  return { exec, executed, audit, context, authz };
}

const actor = (tenantId: string | null) => ({
  userId: 'u1',
  channel: 'telegram' as const,
  tenantId,
  externalRef: '123456789',
});

describe('ActionExecutorService', () => {
  it('spustí čtecí akci v kontextu firmy a zapíše audit s maskovaným id', async () => {
    const { exec, executed, audit, context } = setup({});
    const res = await exec.execute(actor(TENANT_A), 'test.read', { q: 'vrtačka' });
    expect(res).toEqual({ ok: true, key: 'test.read', data: { echo: 'vrtačka' } });
    expect(executed).toEqual([{ q: 'vrtačka' }]);
    expect(context.runInTenant).toHaveBeenCalledWith(TENANT_A, expect.any(Function));
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'channel.test.read',
        context: expect.objectContaining({ channel: 'telegram', externalRef: '12…89' }),
      }),
    );
  });

  it('odmítne firmu, kde uživatel nemá aktivní členství (bez spuštění akce)', async () => {
    const { exec, executed, context } = setup({ memberships: [{ organization_id: TENANT_A }] });
    const res = await exec.execute(actor(TENANT_B), 'test.read', { q: 'x' });
    expect(res).toMatchObject({ ok: false, code: 'INACTIVE_MEMBERSHIP' });
    expect(executed).toEqual([]);
    expect(context.runInTenant).not.toHaveBeenCalled();
  });

  it('bez vybrané firmy vrátí NO_ORGANIZATION', async () => {
    const { exec } = setup({});
    expect(await exec.execute(actor(null), 'test.read', { q: 'x' })).toMatchObject({
      ok: false,
      code: 'NO_ORGANIZATION',
    });
  });

  it('vypnutý kanál ve firmě = CHANNEL_DISABLED', async () => {
    const { exec, executed, authz } = setup({ moduleActive: false });
    const res = await exec.execute(actor(TENANT_A), 'test.read', { q: 'x' });
    expect(res).toMatchObject({ ok: false, code: 'CHANNEL_DISABLED' });
    expect(authz.isModuleActive).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT_A }),
      'channel_telegram',
    );
    expect(executed).toEqual([]);
  });

  it('chybějící oprávnění = MISSING_PERMISSION', async () => {
    const { exec, executed } = setup({ allowed: false });
    expect(await exec.execute(actor(TENANT_A), 'test.read', { q: 'x' })).toMatchObject({
      ok: false,
      code: 'MISSING_PERMISSION',
    });
    expect(executed).toEqual([]);
  });

  it('zápis bez potvrzení vrátí shrnutí a nic neprovede; s potvrzením proběhne', async () => {
    const { exec, executed } = setup({});
    const first = await exec.execute(actor(TENANT_A), 'test.write', {});
    expect(first).toMatchObject({
      ok: false,
      code: 'CONFIRMATION_REQUIRED',
      summary: 'Shrnutí zápisu',
    });
    expect(executed).toEqual([]);
    const second = await exec.execute(actor(TENANT_A), 'test.write', {}, { confirmed: true });
    expect(second).toMatchObject({ ok: true });
    expect(executed).toEqual(['write']);
  });

  it('policy (časové okno) a ztracený scope akci zastaví', async () => {
    const blocked = setup({ blocked: 'Mimo povolený čas' });
    expect(await blocked.exec.execute(actor(TENANT_A), 'test.read', { q: 'x' })).toMatchObject({
      ok: false,
      code: 'POLICY_DENIED',
      message: 'Mimo povolený čas',
    });
    const noScope = setup({ scopeRows: [] });
    expect(await noScope.exec.execute(actor(TENANT_A), 'test.read', { q: 'x' })).toMatchObject({
      ok: false,
      code: 'INACTIVE_MEMBERSHIP',
    });
  });

  it('neplatný vstup, neznámá akce a HTTP chyby služeb se převedou na kódy', async () => {
    const { exec } = setup({});
    expect(await exec.execute(actor(TENANT_A), 'test.read', { q: '' })).toMatchObject({
      code: 'INVALID_INPUT',
    });
    expect(await exec.execute(actor(TENANT_A), 'nope', {})).toMatchObject({
      code: 'UNKNOWN_ACTION',
    });
    expect(await exec.execute(actor(TENANT_A), 'test.notfound', {})).toMatchObject({
      code: 'NOT_FOUND',
      message: 'Položka neexistuje',
    });
  });
});
