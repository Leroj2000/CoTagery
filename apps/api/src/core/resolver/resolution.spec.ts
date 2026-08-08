import { isActiveResolution, type Resolution } from './resolution';

function make(overrides: Partial<Resolution> = {}): Resolution {
  return {
    carrierId: 'c1',
    tenantId: 't1',
    objectId: 'o1',
    carrierType: 'qr',
    carrierStatus: 'active',
    moduleType: 'product',
    objectStatus: 'active',
    validFrom: null,
    validTo: null,
    primaryUrl: 'https://example.com',
    slug: 'x',
    ...overrides,
  };
}

describe('isActiveResolution', () => {
  const now = Date.parse('2026-06-01T00:00:00Z');

  it('aktivní objekt i nosič bez časových hranic → true', () => {
    expect(isActiveResolution(make(), now)).toBe(true);
  });

  it('archivovaný objekt → false', () => {
    expect(isActiveResolution(make({ objectStatus: 'archived' }), now)).toBe(false);
  });

  it('neaktivní nosič → false', () => {
    expect(isActiveResolution(make({ carrierStatus: 'replaced' }), now)).toBe(false);
  });

  it('ještě nezačala platnost (valid_from v budoucnu) → false', () => {
    expect(isActiveResolution(make({ validFrom: '2026-07-01T00:00:00Z' }), now)).toBe(false);
  });

  it('platnost vypršela (valid_to v minulosti) → false', () => {
    expect(isActiveResolution(make({ validTo: '2026-05-01T00:00:00Z' }), now)).toBe(false);
  });
});
