import { clampCopies, isValidCopies } from '../copies';

describe('validace počtu kopií 1–99', () => {
  it('ořízne pod minimum na 1', () => {
    expect(clampCopies(0)).toBe(1);
    expect(clampCopies(-5)).toBe(1);
  });

  it('ořízne nad maximum na 99', () => {
    expect(clampCopies(100)).toBe(99);
    expect(clampCopies(1000)).toBe(99);
  });

  it('propustí platné hodnoty', () => {
    expect(clampCopies(1)).toBe(1);
    expect(clampCopies(3)).toBe(3);
    expect(clampCopies(99)).toBe(99);
  });

  it('zvládne řetězec a nevalidní vstup', () => {
    expect(clampCopies('3')).toBe(3);
    expect(clampCopies('')).toBe(1);
    expect(clampCopies('abc')).toBe(1);
    expect(clampCopies(NaN)).toBe(1);
    expect(clampCopies(2.7)).toBe(2);
  });

  it('isValidCopies přijímá jen celá čísla 1–99', () => {
    expect(isValidCopies(1)).toBe(true);
    expect(isValidCopies(99)).toBe(true);
    expect(isValidCopies(0)).toBe(false);
    expect(isValidCopies(100)).toBe(false);
    expect(isValidCopies(2.5)).toBe(false);
  });
});
