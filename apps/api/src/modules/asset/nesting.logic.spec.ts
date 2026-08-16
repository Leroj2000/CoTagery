import { wouldCreateCycle } from './nesting.logic';

describe('nesting.logic – ochrana proti cyklům', () => {
  // strom: van → (nic); case → van; drill → case
  const parentOf = new Map<string, string | null>([
    ['van', null],
    ['case', 'van'],
    ['drill', 'case'],
  ]);

  it('vložení věci do sebe = cyklus', () => {
    expect(wouldCreateCycle('van', 'van', parentOf)).toBe(true);
  });

  it('vložení kontejneru do svého potomka = cyklus', () => {
    // van do case (case je uvnitř van) → cyklus
    expect(wouldCreateCycle('van', 'case', parentOf)).toBe(true);
    // van do drill (drill je hluboko uvnitř van) → cyklus
    expect(wouldCreateCycle('van', 'drill', parentOf)).toBe(true);
  });

  it('legální vložení nezpůsobí cyklus', () => {
    // nový hammer do van → OK
    expect(wouldCreateCycle('hammer', 'van', parentOf)).toBe(false);
    // drill přesunout do van (z case) → OK
    expect(wouldCreateCycle('drill', 'van', parentOf)).toBe(false);
  });
});
