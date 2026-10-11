import { resolveExportSelection } from '@tagery/shared';
import {
  daysBetween,
  mostUrgent,
  periodBounds,
  periodReadings,
  planState,
  pragueMidnight,
  type VehiclePlanState,
} from './vehicle-inventory.logic';

describe('vehicle-inventory.logic', () => {
  it('půlnoc v Praze (zima i léto)', () => {
    expect(pragueMidnight('2026-01-15').toISOString()).toBe('2026-01-14T23:00:00.000Z');
    expect(pragueMidnight('2026-07-15').toISOString()).toBe('2026-07-14T22:00:00.000Z');
  });

  it('období: konec včetně posledního dne, reference nejpozději teď', () => {
    const past = periodBounds('2026-09-01', '2026-09-30', new Date('2026-10-11T10:00:00Z'));
    expect(past.start.toISOString()).toBe('2026-08-31T22:00:00.000Z');
    expect(past.end.toISOString()).toBe('2026-09-30T22:00:00.000Z');
    expect(past.referenceDay).toBe('2026-09-30');
    const now = new Date('2026-10-11T10:00:00Z');
    const running = periodBounds('2026-10-01', '2026-10-31', now);
    expect(running.reference).toBe(now);
    expect(running.referenceDay).toBe('2026-10-11');
  });

  it('tachometr: začátek = poslední před obdobím, konec = poslední v období', () => {
    const r = (value: number, at: string) => ({ value, observedAt: new Date(at) });
    const start = new Date('2026-09-01T00:00:00Z');
    const end = new Date('2026-10-01T00:00:00Z');
    const readings = [
      r(12000, '2026-09-15T08:00:00Z'),
      r(10000, '2026-08-20T08:00:00Z'),
      r(13500, '2026-09-29T08:00:00Z'),
      r(15000, '2026-10-05T08:00:00Z'),
    ];
    const res = periodReadings(readings, start, end);
    expect([res.start?.value, res.end?.value]).toEqual([10000, 13500]);
    // bez odečtu před obdobím → první v období
    expect(periodReadings(readings.slice(0, 1), start, end).start?.value).toBe(12000);
    // nic v období → konec = poslední před obdobím
    expect(periodReadings([readings[1]], start, end).end?.value).toBe(10000);
    expect(periodReadings([], start, end)).toEqual({ start: null, end: null });
  });

  it('stav intervalu: km a dny do servisu, záporné = po servisu', () => {
    const p = planState(
      {
        code: 'regular',
        title: 'Pravidelný servis',
        status: 'overdue',
        nextMeter: 25000,
        nextDueAt: new Date('2026-09-20T10:00:00Z'),
        lastService: { performedAt: new Date('2025-09-20T10:00:00Z'), meterValue: 10000 },
      },
      25400,
      '2026-09-30',
    );
    expect(p).toMatchObject({
      kmToService: -400,
      nextDueOn: '2026-09-20',
      daysToService: -10,
      lastServiceOn: '2025-09-20',
      lastServiceMeter: 10000,
    });
    expect(daysBetween('2026-09-30', '2026-10-30')).toBe(30);
  });

  it('nejbližší servis: nejhorší stav, pak nejméně dní', () => {
    const plan = (code: string, status: VehiclePlanState['status'], days: number | null) =>
      ({ code, title: code, status, daysToService: days, kmToService: null }) as VehiclePlanState;
    expect(
      mostUrgent([plan('a', 'ok', 5), plan('b', 'soon', 20), plan('c', 'soon', 10)])?.code,
    ).toBe('c');
    expect(mostUrgent([plan('a', 'ok', 5), plan('b', 'overdue', 40)])?.code).toBe('b');
    expect(mostUrgent([])).toBeNull();
  });

  it('nastavení exportu: výchozí, výběr v pořadí katalogu, neznámé klíče pryč', () => {
    const def = resolveExportSelection('vehicleInventory', {});
    expect(def.columns).toContain('odometerEnd');
    expect(def.columns).not.toContain('serialNumber');
    expect(def.sheets).toEqual(['summary']);
    const custom = resolveExportSelection('vehicleInventory', {
      exports: { vehicleInventory: { columns: ['note', 'name', 'xxx'], sheets: [] } },
    });
    expect(custom).toEqual({ columns: ['name', 'note'], sheets: [] });
    // prázdný výběr sloupců = výchozí
    expect(
      resolveExportSelection('stockInventory', {
        exports: { stockInventory: { columns: [] } },
      }).columns,
    ).toContain('result');
  });
});
