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
});
