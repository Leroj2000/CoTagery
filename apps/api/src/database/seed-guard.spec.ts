import { shouldSkipDemoSeed } from './seed-guard';

describe('shouldSkipDemoSeed (SEC-03)', () => {
  it('v produkci demo seed přeskočí', () => {
    expect(shouldSkipDemoSeed({ NODE_ENV: 'production' })).toBe(true);
  });
  it('v produkci ho povolí jen SEED_DEMO=1', () => {
    expect(shouldSkipDemoSeed({ NODE_ENV: 'production', SEED_DEMO: '1' })).toBe(false);
    expect(shouldSkipDemoSeed({ NODE_ENV: 'production', SEED_DEMO: 'true' })).toBe(true);
  });
  it('mimo produkci seed běží', () => {
    expect(shouldSkipDemoSeed({ NODE_ENV: 'development' })).toBe(false);
    expect(shouldSkipDemoSeed({})).toBe(false);
  });
});
