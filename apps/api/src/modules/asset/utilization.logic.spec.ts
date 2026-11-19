import { computeUtilization, stateAfter, verdictFor } from './utilization.logic';

const HOME = 'home';
const d = (s: string): Date => new Date(`${s}T00:00:00Z`);
const now = d('2026-04-01');
const windowStart = d('2026-01-01'); // 90 dní

describe('ZAK-03 vytíženost', () => {
  it('stav podle pohybu', () => {
    expect(stateAfter(null, HOME)).toBe('idle');
    expect(stateAfter({ type: 'loan', toType: 'person', toId: 'p', at: now }, HOME)).toBe('use');
    expect(stateAfter({ type: 'move', toType: 'location', toId: 'site', at: now }, HOME)).toBe(
      'use',
    );
    expect(stateAfter({ type: 'return', toType: 'location', toId: HOME, at: now }, HOME)).toBe(
      'idle',
    );
    expect(stateAfter({ type: 'service_out', toType: 'location', toId: 'x', at: now }, HOME)).toBe(
      'service',
    );
    expect(stateAfter({ type: 'dispose', toType: null, toId: null, at: now }, HOME)).toBe('gone');
  });

  it('celé okno ve skladu = 0 % a ležák', () => {
    const r = computeUtilization(
      { homeLocationId: HOME, createdAt: d('2025-01-01'), before: null, movements: [] },
      windowStart,
      now,
    );
    expect(r.daysTracked).toBe(90);
    expect(r.utilizationPct).toBe(0);
    expect(r.verdict).toBe('idle');
  });

  it('půjčeno půl okna', () => {
    const r = computeUtilization(
      {
        homeLocationId: HOME,
        createdAt: d('2025-01-01'),
        before: null,
        movements: [
          { type: 'loan', toType: 'person', toId: 'p', at: d('2026-01-01') },
          { type: 'return', toType: 'location', toId: HOME, at: d('2026-02-15') },
        ],
      },
      windowStart,
      now,
    );
    expect(r.daysInUse).toBe(45);
    expect(r.utilizationPct).toBe(50);
    expect(r.verdict).toBe('ok');
  });

  it('stav z pohybu před oknem: stále půjčeno = přetížené', () => {
    const r = computeUtilization(
      {
        homeLocationId: HOME,
        createdAt: d('2025-01-01'),
        before: { type: 'loan', toType: 'person', toId: 'p', at: d('2025-12-01') },
        movements: [],
      },
      windowStart,
      now,
    );
    expect(r.utilizationPct).toBe(100);
    expect(r.verdict).toBe('overused');
  });

  it('nová položka se nehodnotí', () => {
    const r = computeUtilization(
      { homeLocationId: HOME, createdAt: d('2026-03-25'), before: null, movements: [] },
      windowStart,
      now,
    );
    expect(r.daysTracked).toBe(7);
    expect(r.verdict).toBe('new');
  });

  it('vyřazení zastaví počítání', () => {
    const r = computeUtilization(
      {
        homeLocationId: HOME,
        createdAt: d('2025-01-01'),
        before: { type: 'loan', toType: 'person', toId: 'p', at: d('2025-12-01') },
        movements: [{ type: 'dispose', toType: null, toId: null, at: d('2026-01-31') }],
      },
      windowStart,
      now,
    );
    expect(r.daysTracked).toBe(30);
    expect(r.utilizationPct).toBe(100);
  });

  it('verdikt hranice', () => {
    expect(verdictFor(80, 90, 0)).toBe('overused');
    expect(verdictFor(4, 90, 59)).toBe('ok');
    expect(verdictFor(4, 90, 60)).toBe('idle');
  });
});
