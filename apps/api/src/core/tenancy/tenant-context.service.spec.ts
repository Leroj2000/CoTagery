import type { DataSource, EntityManager } from 'typeorm';
import { TenantContextService } from './tenant-context.service';

describe('TenantContextService', () => {
  const defaultManager = { id: 'default' } as unknown as EntityManager;
  const dataSource = { manager: defaultManager } as unknown as DataSource;

  it('mimo request vrací výchozí manager a undefined tenantId', () => {
    const svc = new TenantContextService(dataSource);
    expect(svc.tenantId).toBeUndefined();
    expect(svc.manager).toBe(defaultManager);
  });

  it('uvnitř run() vidí tenant kontext a scoped manager', async () => {
    const svc = new TenantContextService(dataSource);
    const scopedManager = { id: 'scoped' } as unknown as EntityManager;

    await svc.run({ tenantId: 't1', manager: scopedManager }, async () => {
      expect(svc.tenantId).toBe('t1');
      expect(svc.manager).toBe(scopedManager);
    });

    // Po opuštění kontextu opět fallback.
    expect(svc.tenantId).toBeUndefined();
    expect(svc.manager).toBe(defaultManager);
  });

  function fakeDataSource(commit: () => Promise<void>) {
    const qr = {
      manager: { id: 'tx' },
      connect: jest.fn(async () => undefined),
      startTransaction: jest.fn(async () => undefined),
      query: jest.fn(async () => undefined),
      commitTransaction: jest.fn(commit),
      rollbackTransaction: jest.fn(async () => undefined),
      release: jest.fn(async () => undefined),
    };
    return { manager: defaultManager, createQueryRunner: () => qr } as unknown as DataSource;
  }
  const flush = () => new Promise((r) => setImmediate(r));

  it('afterCommit běží až po COMMIT a mimo transakci', async () => {
    const order: string[] = [];
    const svc = new TenantContextService(
      fakeDataSource(async () => {
        order.push('commit');
      }),
    );
    let seenTenant: string | undefined = 'x';
    await svc.runInTenant('t1', async () => {
      svc.afterCommit(() => {
        order.push('hook');
        seenTenant = svc.tenantId;
      });
      order.push('handler');
    });
    await flush();
    expect(order).toEqual(['handler', 'commit', 'hook']);
    expect(seenTenant).toBeUndefined();
  });

  it('afterCommit se při rollbacku nespustí', async () => {
    const hook = jest.fn();
    const svc = new TenantContextService(fakeDataSource(async () => undefined));
    await expect(
      svc.runInTenant('t1', async () => {
        svc.afterCommit(hook);
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    await flush();
    expect(hook).not.toHaveBeenCalled();
  });

  it('chyba v afterCommit neshodí request', async () => {
    const svc = new TenantContextService(fakeDataSource(async () => undefined));
    const res = await svc.runInTenant('t1', async () => {
      svc.afterCommit(async () => {
        throw new Error('smtp down');
      });
      return 'ok';
    });
    await flush();
    expect(res).toBe('ok');
  });
});
