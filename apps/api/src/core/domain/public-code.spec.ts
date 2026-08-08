import { generatePublicCode } from './public-code';

describe('generatePublicCode', () => {
  it('má výchozí délku 12 a jen base62 znaky', () => {
    const code = generatePublicCode();
    expect(code).toHaveLength(12);
    expect(code).toMatch(/^[0-9A-Za-z]{12}$/);
  });

  it('respektuje zadanou délku', () => {
    expect(generatePublicCode(20)).toHaveLength(20);
  });

  it('generuje různé kódy (bez kolizí na vzorku)', () => {
    const set = new Set(Array.from({ length: 1000 }, () => generatePublicCode()));
    expect(set.size).toBe(1000);
  });
});
