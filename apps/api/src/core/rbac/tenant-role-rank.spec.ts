import { roleMeets } from './tenant-role-rank';

describe('tenant-role-rank', () => {
  it('vyšší role splní nižší požadavek', () => {
    expect(roleMeets('OWNER', 'EDITOR')).toBe(true);
    expect(roleMeets('ADMIN', 'MANAGER')).toBe(true);
    expect(roleMeets('MANAGER', 'MANAGER')).toBe(true);
  });

  it('nižší role neprojde', () => {
    expect(roleMeets('EDITOR', 'MANAGER')).toBe(false);
    expect(roleMeets('VIEWER', 'EDITOR')).toBe(false);
    expect(roleMeets('SCAN_ONLY', 'VIEWER')).toBe(false);
  });

  it('OWNER splní vše, SCAN_ONLY jen sebe', () => {
    expect(roleMeets('OWNER', 'OWNER')).toBe(true);
    expect(roleMeets('SCAN_ONLY', 'SCAN_ONLY')).toBe(true);
    expect(roleMeets('SCAN_ONLY', 'EDITOR')).toBe(false);
  });
});
