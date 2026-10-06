import { addCalendarMonths, calculateMaintenance } from './maintenance.logic';

describe('maintenance due calculation', () => {
  const rule = { intervalUnits: 15000, intervalMonths: 12 };
  const last = { performedAt: new Date('2025-01-15T12:00:00Z'), meterValue: 100000 };

  it('does not invent an overdue state without a completed service', () => {
    expect(calculateMaintenance(rule, null, 120000).status).toBe('not_started');
  });

  it('uses the earlier of odometer and calendar deadlines', () => {
    expect(calculateMaintenance(rule, last, 115000, new Date('2025-06-01')).status).toBe('overdue');
    expect(calculateMaintenance(rule, last, 101000, new Date('2026-01-16')).status).toBe('overdue');
    expect(calculateMaintenance(rule, last, 101000, new Date('2026-01-15')).status).toBe('soon');
  });

  it('warns inside ten percent of the meter interval or 30 days of the date', () => {
    expect(calculateMaintenance(rule, last, 113500, new Date('2025-06-01')).status).toBe('soon');
    expect(calculateMaintenance(rule, last, 101000, new Date('2025-12-20')).status).toBe('soon');
    expect(calculateMaintenance(rule, last, 101000, new Date('2025-06-01')).status).toBe('ok');
  });

  it('needs a reading when the plan has no calendar limit', () => {
    expect(
      calculateMaintenance({ intervalUnits: 250, intervalMonths: null }, last, null).status,
    ).toBe('need_reading');
  });

  it('does not claim a vehicle is in time when its mileage is unknown', () => {
    expect(calculateMaintenance(rule, last, null, new Date('2025-06-01')).status).toBe(
      'need_reading',
    );
  });

  it('clamps end-of-month dates instead of rolling into a later month', () => {
    expect(addCalendarMonths(new Date('2025-01-31T00:00:00Z'), 1).toISOString()).toBe(
      '2025-02-28T00:00:00.000Z',
    );
  });
});
