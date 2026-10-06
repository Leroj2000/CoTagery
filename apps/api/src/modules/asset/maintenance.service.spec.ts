import { MaintenanceService } from './maintenance.service';
import type { TenantContextService } from '../../core/tenancy/tenant-context.service';
import type { AssetService } from './asset.service';
import type { AuditService } from '../../core/rbac/audit.service';

describe('MaintenanceService', () => {
  function setup(kind: 'vehicle' | 'machine' = 'vehicle') {
    const reading = {
      id: 'reading',
      assetId: 'asset',
      value: 20000,
      observedAt: new Date('2026-01-01'),
      createdAt: new Date('2026-01-01'),
      deletedAt: null as Date | null,
    };
    const serviceRecord = {
      id: 'service',
      assetId: 'asset',
      planCode: 'regular',
      meterValue: 1000,
      performedAt: new Date('2025-01-01'),
      createdAt: new Date('2025-01-01'),
    };
    const readings = {
      find: jest.fn().mockResolvedValue([reading]),
      findOne: jest.fn().mockResolvedValue(reading),
      save: jest.fn(async (input) => input),
      create: jest.fn((input) => input),
    };
    const context = {
      tenantId: 'tenant',
      manager: {
        query: jest.fn().mockResolvedValue([]),
        getRepository: (entity: { name: string }) => {
          if (entity.name === 'Category')
            return {
              findOne: jest.fn().mockResolvedValue({ id: 'category', equipmentKind: kind }),
            };
          if (entity.name === 'MeterReading') return readings;
          if (entity.name === 'MaintenanceRule') return { find: jest.fn().mockResolvedValue([]) };
          if (entity.name === 'ServiceRecord')
            return {
              find: jest.fn().mockResolvedValue([serviceRecord]),
              findOne: jest.fn().mockResolvedValue(serviceRecord),
            };
          throw new Error(`Unexpected entity ${entity.name}`);
        },
      },
    } as unknown as TenantContextService;
    const assets = { get: jest.fn().mockResolvedValue({ id: 'asset', categoryId: 'category' }) };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const maintenance = new MaintenanceService(
      context,
      assets as unknown as AssetService,
      audit as unknown as AuditService,
    );
    return { maintenance, reading, readings, audit };
  }

  it('marks a linked plan overdue from the saved meter reading', async () => {
    const { maintenance } = setup();
    const summary = await maintenance.summary('asset');
    expect(summary.unit).toBe('km');
    expect(summary.plans.find((plan) => plan.code === 'regular')).toMatchObject({
      nextMeter: 16000,
      status: 'overdue',
    });
  });

  it('soft-deletes a wrong reading and leaves an audit event', async () => {
    const { maintenance, reading, readings, audit } = setup();
    await maintenance.deleteReading('asset', 'reading');
    expect(reading.deletedAt).toBeInstanceOf(Date);
    expect(readings.save).toHaveBeenCalledWith(reading);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'asset.meter_reading_deleted' }),
    );
  });

  it('accepts tenths for machines but only whole kilometres for vehicles', async () => {
    await expect(setup().maintenance.addReading('asset', { value: 20000.5 })).rejects.toThrow(
      'Stav kilometrů musí být celé číslo.',
    );
    await expect(
      setup('machine').maintenance.addReading('asset', { value: 20000.5 }),
    ).resolves.toMatchObject({ value: 20000.5 });
  });
});
