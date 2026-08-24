import { wrapText } from '../render-label';

// Deterministické „měření“: 1 znak = 10 px. Nezávislé na canvasu.
const measure = (s: string): number => s.length * 10;

describe('převod dlouhého názvu na omezený počet řádků', () => {
  it('krátký název se vejde na jeden řádek', () => {
    expect(wrapText('Vrtačka', 200, 3, measure)).toEqual(['Vrtačka']);
  });

  it('zalomí text na více řádků podle šířky', () => {
    // šířka 100 px = 10 znaků na řádek
    const lines = wrapText('aaaa bbbb cccc dddd', 100, 3, measure);
    expect(lines.length).toBeLessThanOrEqual(3);
    for (const l of lines) expect(measure(l)).toBeLessThanOrEqual(100);
  });

  it('omezí počet řádků a přidá výpustku u přetečení', () => {
    const lines = wrapText('slovo1 slovo2 slovo3 slovo4 slovo5 slovo6', 80, 2, measure);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith('…')).toBe(true);
    for (const l of lines) expect(measure(l)).toBeLessThanOrEqual(80);
  });

  it('rozdělí i slovo delší než řádek', () => {
    const lines = wrapText('nedělitelneslovoveludelsi', 100, 3, measure);
    for (const l of lines) expect(measure(l.replace('…', ''))).toBeLessThanOrEqual(100);
  });

  it('prázdný vstup vrací jeden prázdný řádek', () => {
    expect(wrapText('   ', 100, 3, measure)).toEqual(['']);
  });
});
