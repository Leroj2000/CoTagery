import type { Repository } from 'typeorm';
import { ModulesService, MVP_DEFAULT_INACTIVE_MODULES } from './modules.service';
import { OrganizationModule } from './entities/organization-module.entity';
import type { TenantContextService } from '../tenancy/tenant-context.service';
import type { AuthzService } from './authz.service';
import type { AuditService } from './audit.service';

function setup(rows: Partial<OrganizationModule>[] = []) {
  const repo = {
    find: jest.fn().mockResolvedValue(rows),
    findOne: jest
      .fn()
      .mockImplementation(({ where }: { where: { moduleKey: string } }) =>
        Promise.resolve(rows.find((row) => row.moduleKey === where.moduleKey) ?? null),
      ),
  } as unknown as Repository<OrganizationModule>;
  const context = {
    tenantId: 'tenant-1',
    manager: { getRepository: jest.fn().mockReturnValue(repo) },
  } as unknown as TenantContextService;
  const service = new ModulesService(
    context,
    { invalidateModules: jest.fn() } as unknown as AuthzService,
    { record: jest.fn() } as unknown as AuditService,
  );
  return { service, repo };
}

describe('ModulesService', () => {
  it('považuje chybějící řádek za aktivní kvůli kompatibilitě existujících firem', async () => {
    const { service } = setup();
    await expect(service.isActive('rental')).resolves.toBe(true);
  });

  it('vrátí vypnutý řízený modul a core modul ponechá aktivní', async () => {
    const { service } = setup([{ moduleKey: 'rental', state: 'inactive' }]);
    await expect(service.isActive('rental')).resolves.toBe(false);
    await expect(service.isActive('asset')).resolves.toBe(true);
  });

  it('má výchozí MVP rozšíření v katalogu řízených modulů', () => {
    expect(MVP_DEFAULT_INACTIVE_MODULES).toEqual(
      expect.arrayContaining(['rental', 'membership', 'billing', 'access']),
    );
  });
});
