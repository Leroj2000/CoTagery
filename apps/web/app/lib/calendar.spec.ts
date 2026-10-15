import type { CalendarItem } from '@tagery/shared';
import {
  dayKey,
  gridRange,
  itemDays,
  localToIso,
  monthGrid,
  parseMonth,
  monthParam,
} from './calendar';

const item = (over: Partial<CalendarItem>): CalendarItem => ({
  id: 'x',
  source: 'event',
  title: 'X',
  start: '2026-10-15T08:00:00.000Z',
  end: null,
  allDay: false,
  ...over,
});

it('převádí čas firmy na UTC včetně letního času', () => {
  expect(localToIso('2026-07-01T10:00')).toBe('2026-07-01T08:00:00.000Z');
  expect(localToIso('2026-12-01T10:00')).toBe('2026-12-01T09:00:00.000Z');
  expect(localToIso('2026-12-01')).toBe('2026-11-30T23:00:00.000Z');
  expect(localToIso('nesmysl')).toBeNull();
});

it('den položky se počítá v zóně firmy', () => {
  expect(dayKey('2026-10-15T22:30:00.000Z')).toBe('2026-10-16');
  expect(dayKey('2026-01-15T22:30:00.000Z')).toBe('2026-01-15');
});

it('rozsah dnů: celodenní s exkluzivním koncem, vícedenní, bez konce', () => {
  expect(
    itemDays(
      item({ allDay: true, start: '2026-10-20T00:00:00.000Z', end: '2026-10-21T00:00:00.000Z' }),
    ),
  ).toEqual(['2026-10-20']);
  expect(
    itemDays(item({ start: '2026-10-30T10:00:00.000Z', end: '2026-11-01T10:00:00.000Z' })),
  ).toEqual(['2026-10-30', '2026-10-31', '2026-11-01']);
  expect(itemDays(item({}))).toEqual(['2026-10-15']);
});

it('měsíční mřížka začíná pondělím a pokrývá celý měsíc', () => {
  const grid = monthGrid(2026, 9); // říjen 2026, 1. 10. je čtvrtek
  expect(grid[0][0]).toBe('2026-09-28');
  expect(grid[0][3]).toBe('2026-10-01');
  expect(grid.flat()).toContain('2026-10-31');
  expect(grid.every((w) => w.length === 7)).toBe(true);
  const range = gridRange(grid);
  expect(range.from < '2026-09-28').toBe(true);
});

it('parametr měsíce', () => {
  expect(parseMonth('2026-02')).toEqual({ year: 2026, month: 1 });
  expect(parseMonth('2026-13', new Date('2026-10-15T12:00:00Z'))).toEqual({ year: 2026, month: 9 });
  expect(monthParam(2026, 12)).toBe('2027-01');
  expect(monthParam(2026, -1)).toBe('2025-12');
});
