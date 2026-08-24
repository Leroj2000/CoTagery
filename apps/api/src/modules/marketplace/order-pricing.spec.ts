import { computeQuote, type QuoteListing } from './order-pricing';

const base: QuoteListing = {
  pricePerDay: '500',
  depositAmount: '2000',
  currency: 'CZK',
  minDays: 1,
  maxDays: null,
};

const d = (s: string): Date => new Date(s);

describe('computeQuote', () => {
  it('spočítá cenu pro celé dny (den × sazba + kauce)', () => {
    const q = computeQuote(base, d('2026-09-01T09:00:00Z'), d('2026-09-04T09:00:00Z'));
    expect(q.days).toBe(3);
    expect(q.rentAmount).toBe('1500.00');
    expect(q.depositAmount).toBe('2000.00');
    expect(q.total).toBe('3500.00');
    expect(q.currency).toBe('CZK');
  });

  it('zaokrouhluje nedokončený den nahoru', () => {
    const q = computeQuote(base, d('2026-09-01T09:00:00Z'), d('2026-09-02T15:00:00Z'));
    expect(q.days).toBe(2);
    expect(q.rentAmount).toBe('1000.00');
  });

  it('uplatní minimální počet dní na cenu', () => {
    const q = computeQuote({ ...base, minDays: 3 }, d('2026-09-01T09:00:00Z'), d('2026-09-04T09:00:00Z'));
    expect(q.days).toBe(3);
  });

  it('odmítne období kratší než minDays', () => {
    expect(() =>
      computeQuote({ ...base, minDays: 3 }, d('2026-09-01T09:00:00Z'), d('2026-09-02T09:00:00Z')),
    ).toThrow('below_min_days');
  });

  it('odmítne období delší než maxDays', () => {
    expect(() =>
      computeQuote({ ...base, maxDays: 5 }, d('2026-09-01T00:00:00Z'), d('2026-09-10T00:00:00Z')),
    ).toThrow('above_max_days');
  });

  it('odmítne konec ≤ začátek', () => {
    expect(() =>
      computeQuote(base, d('2026-09-04T09:00:00Z'), d('2026-09-01T09:00:00Z')),
    ).toThrow('invalid_period');
  });
});
