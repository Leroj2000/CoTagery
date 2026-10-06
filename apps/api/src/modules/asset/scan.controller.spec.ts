import { ScanController } from './scan.controller';
import type { AssetService } from './asset.service';
import type { AuthzService } from '../../core/rbac/authz.service';
import type { RequestUser } from '../../core/auth/jwt-auth.guard';

describe('Identification is separate from observation and permission to act', () => {
  const user = { userId: 'actor' } as RequestUser;
  function setup(allowed: boolean) {
    const scanLookup = jest
      .fn()
      .mockResolvedValue({ found: true, asset: { actions: ['loan'] }, primaryAction: 'loan' });
    const controller = new ScanController(
      { scanLookup } as unknown as AssetService,
      { can: async () => ({ allowed }) } as unknown as AuthzService,
    );
    return { controller, scanLookup };
  }
  it('GET resolves read-only and removes unavailable movement actions', async () => {
    const s = setup(false);
    await expect(s.controller.lookup('QR', user)).resolves.toMatchObject({
      asset: { actions: [] },
      primaryAction: null,
    });
    expect(s.scanLookup).toHaveBeenCalledWith('QR', 'actor', undefined, false);
  });
  it('POST records context and retains permitted actions', async () => {
    const s = setup(true);
    await expect(
      s.controller.capture({ code: 'QR', technology: 'nfc' }, user),
    ).resolves.toMatchObject({ asset: { actions: ['loan'] } });
    expect(s.scanLookup).toHaveBeenCalledWith('QR', 'actor', { technology: 'nfc' });
  });
});
