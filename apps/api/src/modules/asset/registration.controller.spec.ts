import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { validate } from 'class-validator';
import { RegistrationController, RegisterAssetDto } from './registration.controller';
import type { AssetService } from './asset.service';
import type { TenantContextService } from '../../core/tenancy/tenant-context.service';
import type { DataCarriersService } from '../../core/domain/carriers/data-carriers.service';
import type { AuthzService } from '../../core/rbac/authz.service';
import type { RequestUser } from '../../core/auth/jwt-auth.guard';

const user = { userId: 'actor', tenantId: 'tenant', tenantRole: 'OWNER' } as RequestUser;
const dto: RegisterAssetDto = {
  requestId: '7494591a-46bf-401c-b27e-7309d6f09038',
  name: 'Vrtačka',
  identifierMode: 'generate',
  carrierType: 'qr',
};
function setup(
  previous: unknown[] = [],
  scope = { type: 'ORGANIZATION', ref: null as string | null },
) {
  const asset = { id: 'asset', digitalObjectId: 'object' };
  const assets = {
    create: jest.fn().mockResolvedValue(asset),
    getByObject: jest.fn().mockResolvedValue(asset),
  };
  const repository = { update: jest.fn(), findOneBy: jest.fn().mockResolvedValue(null) };
  const query = jest
    .fn()
    .mockImplementation((sql: string) =>
      Promise.resolve(sql.includes('SELECT id, metadata') ? previous : []),
    );
  const carriers = {
    createForObject: jest.fn(),
    listForObject: jest.fn().mockResolvedValue([]),
    adoptExternal: jest.fn(),
    findByCode: jest.fn(),
    claim: jest.fn(),
  };
  const authz = { assert: jest.fn() };
  const controller = new RegistrationController(
    assets as unknown as AssetService,
    {
      manager: { query, getRepository: () => repository },
      tenantId: 'tenant',
      scope,
    } as unknown as TenantContextService,
    carriers as unknown as DataCarriersService,
    authz as unknown as AuthzService,
  );
  return { controller, assets, repository, carriers, authz, query };
}
describe('Atomic asset registration', () => {
  it('validates the request ID and registration mode', async () => {
    const invalid = Object.assign(new RegisterAssetDto(), dto, {
      requestId: 'bad',
      identifierMode: 'attach-anything',
    });
    expect((await validate(invalid)).map((e) => e.property)).toEqual(
      expect.arrayContaining(['requestId', 'identifierMode']),
    );
  });
  it('creates one identity and identifier and persists the retry receipt', async () => {
    const s = setup();
    await s.controller.register(dto, user);
    expect(s.assets.create).toHaveBeenCalledWith({ name: 'Vrtačka' });
    expect(s.carriers.createForObject).toHaveBeenCalledWith('object', { carrierType: 'qr' });
    expect(s.repository.update).toHaveBeenCalledWith('object', {
      metadata: expect.objectContaining({
        registrationId: dto.requestId,
        registrationActor: 'actor',
      }),
    });
    expect(s.query.mock.calls[0][0]).toContain('pg_advisory_xact_lock');
  });
  it('returns the same item for an identical retry without creating a carrier', async () => {
    const digest = createHash('sha256')
      .update(JSON.stringify(Object.entries(dto).sort(([a], [b]) => a.localeCompare(b))))
      .digest('hex');
    const s = setup([
      { id: 'object', metadata: { registrationActor: 'actor', registrationDigest: digest } },
    ]);
    await expect(s.controller.register(dto, user)).resolves.toMatchObject({
      asset: { id: 'asset' },
    });
    expect(s.assets.create).not.toHaveBeenCalled();
    expect(s.carriers.createForObject).not.toHaveBeenCalled();
  });
  it('refuses reuse by another actor or with a changed payload', async () => {
    const s = setup([{ id: 'object', metadata: {} }]);
    await expect(s.controller.register(dto, user)).rejects.toBeInstanceOf(ConflictException);
    expect(s.assets.create).not.toHaveBeenCalled();
  });
  it('requires carrier permission before making writes', async () => {
    const s = setup();
    s.authz.assert.mockRejectedValue(new ForbiddenException());
    await expect(s.controller.register(dto, user)).rejects.toBeInstanceOf(ForbiddenException);
    expect(s.assets.create).not.toHaveBeenCalled();
  });
  it('does not require carrier permission when tagging is deferred', async () => {
    const s = setup();
    await s.controller.register({ ...dto, identifierMode: 'none' }, user);
    expect(s.authz.assert).not.toHaveBeenCalled();
  });
  it('rejects a missing scoped home and a foreign location before creating an item', async () => {
    const scoped = setup([], { type: 'LOCATION_TREE', ref: 'root' });
    await expect(scoped.controller.register(dto, user)).rejects.toBeInstanceOf(BadRequestException);
    const foreign = setup();
    await expect(
      foreign.controller.register({ ...dto, homeLocationId: 'foreign' }, user),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(scoped.assets.create).not.toHaveBeenCalled();
    expect(foreign.assets.create).not.toHaveBeenCalled();
  });
  it('rejects occupied labels and propagates failure to the transaction', async () => {
    const s = setup();
    s.carriers.findByCode.mockResolvedValue({ digitalObjectId: 'occupied' });
    await expect(
      s.controller.register({ ...dto, identifierMode: 'claim', code: 'QR' }, user),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(s.carriers.claim).not.toHaveBeenCalled();
    expect(s.repository.update).not.toHaveBeenCalled();
  });
});
