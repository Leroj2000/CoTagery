import { classifyScan, computeResult } from './inventory.logic';

describe('inventory.logic – nalezeno/chybí/navíc', () => {
  const expected = new Set(['a', 'b', 'c']);

  it('classifyScan: očekávaný → found, cizí → unexpected', () => {
    expect(classifyScan(expected, 'a')).toBe('found');
    expect(classifyScan(expected, 'x')).toBe('unexpected');
  });

  it('computeResult: nalezeno + chybí + navíc', () => {
    // naskenováno: a (found), c (found), x (unexpected). b chybí.
    const r = computeResult(expected, ['a', 'c', 'x']);
    expect(r.found.sort()).toEqual(['a', 'c']);
    expect(r.missing).toEqual(['b']);
    expect(r.unexpected).toEqual(['x']);
    expect(r.expectedCount).toBe(3);
  });

  it('vše nalezeno → nic nechybí, nic navíc', () => {
    const r = computeResult(expected, ['a', 'b', 'c']);
    expect(r.found.sort()).toEqual(['a', 'b', 'c']);
    expect(r.missing).toEqual([]);
    expect(r.unexpected).toEqual([]);
  });

  it('duplicitní sken se nezapočítá dvakrát', () => {
    const r = computeResult(expected, ['a', 'a', 'a']);
    expect(r.found).toEqual(['a']);
    expect(r.missing.sort()).toEqual(['b', 'c']);
  });

  it('prázdná inventura', () => {
    const r = computeResult(new Set(), []);
    expect(r).toEqual({ found: [], missing: [], unexpected: [], expectedCount: 0 });
  });
});
