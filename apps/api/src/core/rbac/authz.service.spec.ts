import type { DataSource } from 'typeorm';
import { AuthzService } from './authz.service';
import type { RequestUser } from '../auth/jwt-auth.guard';

/** Mock DB: členství identity + oprávnění role (podle klíče role). */
function build(
  perms: string[] | Record<string, string[]>,
  memberships: { organization_id: string; role: string }[] = [],
) {
  const query = jest.fn().mockImplementation((sql: string, params: unknown[]) => {
    if (sql.includes('my_memberships')) return Promise.resolve(memberships);
    if (sql.includes('tenant_role_permission_keys')) {
      const keys = Array.isArray(perms) ? perms : (perms[String(params[1]).toLowerCase()] ?? []);
      return Promise.resolve(keys.map((key) => ({ key })));
    }
    return Promise.resolve([]);
  });
  const ds = { query } as unknown as DataSource;
  return { svc: new AuthzService(ds), query };
}
const user = (role: string): RequestUser => ({
  userId: 'u1',
  tenantId: 't1',
  tenantRole: role as never,
});

describe('AuthzService', () => {
  it('povolí permission, kterou role má', async () => {
    const { svc } = build(['asset.item.view', 'asset.item.update']);
    const d = await svc.can(user('EDITOR'), 'asset.item.update');
    expect(d.allowed).toBe(true);
    expect(d.reasonCode).toBe('ALLOWED');
  });

  it('odmítne chybějící permission (MISSING_PERMISSION, default deny)', async () => {
    const { svc } = build(['asset.item.view']);
    const d = await svc.can(user('EDITOR'), 'core.role.manage');
    expect(d.allowed).toBe(false);
    expect(d.reasonCode).toBe('MISSING_PERMISSION');
  });

  it('vyhodnocuje roli ve firmě a cachuje (2 volání = 1 dotaz na členství + 1 na role)', async () => {
    const { svc, query } = build(['asset.scan.use']);
    await svc.can(user('SCAN_ONLY'), 'asset.scan.use');
    await svc.can(user('SCAN_ONLY'), 'asset.item.view');
    expect(query).toHaveBeenCalledTimes(2);
    const roleCall = query.mock.calls.find((c) =>
      String(c[0]).includes('tenant_role_permission_keys'),
    );
    expect(roleCall?.[1]).toEqual(['t1', 'SCAN_ONLY']);
  });

  it('bere aktuální roli z členství, ne zastaralou z tokenu', async () => {
    const { svc } = build({ admin: ['core.role.manage'], viewer: ['asset.item.view'] }, [
      { organization_id: 't1', role: 'VIEWER' },
    ]);
    // Token pořád tvrdí ADMIN, ale role byla mezitím snížena na VIEWER.
    expect((await svc.can(user('ADMIN'), 'core.role.manage')).allowed).toBe(false);
    expect((await svc.can(user('ADMIN'), 'asset.item.view')).allowed).toBe(true);
  });

  it('invalidate(firma) zahodí cache rolí jen té firmy', async () => {
    const { svc, query } = build(['asset.item.view']);
    await svc.can(user('EDITOR'), 'asset.item.view');
    svc.invalidate('t1');
    await svc.can(user('EDITOR'), 'asset.item.view');
    expect(
      query.mock.calls.filter((c) => String(c[0]).includes('tenant_role_permission_keys')),
    ).toHaveLength(2);
  });

  it('assert vyhodí při chybějící permission', async () => {
    const { svc } = build([]);
    await expect(svc.assert(user('VIEWER'), 'asset.item.delete')).rejects.toThrow(
      /Chybí oprávnění/,
    );
  });

  it('odmítne vypnutý modul i vlastníkovi organizace', async () => {
    const query = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('org_inactive_modules')) return Promise.resolve([{ module_key: 'rental' }]);
      return Promise.resolve([]);
    });
    const svc = new AuthzService({ query } as unknown as DataSource);

    await expect(svc.assertModuleActive(user('OWNER'), 'rental')).rejects.toThrow(
      /INACTIVE_MODULE/,
    );
    await expect(svc.isModuleActive(user('OWNER'), 'asset')).resolves.toBe(true);
  });
});
