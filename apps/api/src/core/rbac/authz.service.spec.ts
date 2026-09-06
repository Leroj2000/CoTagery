import type { DataSource } from 'typeorm';
import { AuthzService } from './authz.service';
import type { RequestUser } from '../auth/jwt-auth.guard';

function build(perms: string[]) {
  const query = jest.fn().mockResolvedValue(perms.map((key) => ({ key })));
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

  it('mapuje tenantRole na lowercase role key a cachuje (1 dotaz na 2 volání)', async () => {
    const { svc, query } = build(['asset.scan.use']);
    await svc.can(user('SCAN_ONLY'), 'asset.scan.use');
    await svc.can(user('SCAN_ONLY'), 'asset.item.view');
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1]).toEqual(['scan_only']);
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
