import { CategoriesService } from './categories.service';
import type { TenantContextService } from '../../core/tenancy/tenant-context.service';

describe('CategoriesService.create', () => {
  it('links existing free-text assets with an exact category name', async () => {
    const categoryRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((input) => input),
      save: jest.fn().mockResolvedValue({ id: 'category', name: 'Vozidla', equipmentKind: 'vehicle' }),
    };
    const assetRepo = { update: jest.fn().mockResolvedValue({ affected: 1 }) };
    const context = {
      tenantId: 'tenant',
      manager: {
        getRepository: (entity: { name: string }) =>
          entity.name === 'Category' ? categoryRepo : assetRepo,
      },
    } as unknown as TenantContextService;
    const service = new CategoriesService(context);

    await service.create({ name: 'Vozidla', equipmentKind: 'vehicle' });

    expect(assetRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'Vozidla' }),
      { categoryId: 'category' },
    );
  });
});
