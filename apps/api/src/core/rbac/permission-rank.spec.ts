import { highestPermission, permissionMeets } from './permission-rank';

describe('permission-rank', () => {
  it('permissionMeets respektuje hierarchii', () => {
    expect(permissionMeets('manage', 'edit')).toBe(true);
    expect(permissionMeets('edit', 'edit')).toBe(true);
    expect(permissionMeets('view', 'edit')).toBe(false);
    expect(permissionMeets('owner', 'manage')).toBe(true);
    expect(permissionMeets('scan_only', 'view')).toBe(false);
  });

  it('highestPermission vrátí nejvyšší úroveň', () => {
    expect(highestPermission(['view', 'manage', 'edit'])).toBe('manage');
    expect(highestPermission(['scan_only'])).toBe('scan_only');
    expect(highestPermission([])).toBeNull();
  });
});
