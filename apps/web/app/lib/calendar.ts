import type { CalendarItem, CalendarSource } from '@tagery/shared';

/**
 * Pomocníci kalendáře (web). Vše se počítá v časové zóně firmy (Europe/Prague),
 * nezávisle na zóně serveru/prohlížeče. Den = klíč `YYYY-MM-DD`.
 */
export const CALENDAR_TZ = 'Europe/Prague';

const DAY_MS = 24 * 60 * 60 * 1000;

export const WEEKDAYS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'];

export const MONTHS = [
  'Leden',
  'Únor',
  'Březen',
  'Duben',
  'Květen',
  'Červen',
  'Červenec',
  'Srpen',
  'Září',
  'Říjen',
  'Listopad',
  'Prosinec',
];

/** Barvy štítků podle zdroje (Tailwind třídy). */
export const SOURCE_STYLES: Record<CalendarSource, string> = {
  event: 'bg-brand-50 text-brand-700 ring-brand-200',
  reservation: 'bg-sky-50 text-sky-700 ring-sky-200',
  loan: 'bg-amber-50 text-amber-700 ring-amber-200',
  service: 'bg-violet-50 text-violet-700 ring-violet-200',
  warranty: 'bg-red-50 text-red-700 ring-red-200',
  inventory: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  tire_slot: 'bg-orange-50 text-orange-700 ring-orange-200',
};

const partsFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: CALENDAR_TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function zonedParts(date: Date): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of partsFmt.formatToParts(date)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value);
  }
  return out;
}

/** Posun zóny firmy vůči UTC v minutách pro daný okamžik (CET 60, CEST 120). */
export function tzOffsetMinutes(date: Date): number {
  const p = zonedParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** `YYYY-MM-DDTHH:mm` (vstup datetime-local, čas firmy) → ISO v UTC. */
export function localToIso(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h = '00', mi = '00'] = m;
  const naive = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  // Dvojí korekce kvůli přechodu letního času.
  let ts = naive - tzOffsetMinutes(new Date(naive)) * 60000;
  ts = naive - tzOffsetMinutes(new Date(ts)) * 60000;
  return new Date(ts).toISOString();
}

/** Den (v zóně firmy) pro okamžik. */
export function dayKey(iso: string | Date): string {
  const p = zonedParts(typeof iso === 'string' ? new Date(iso) : iso);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

function addDays(key: string, days: number): string {
  const t = Date.parse(`${key}T12:00:00Z`) + days * DAY_MS;
  return new Date(t).toISOString().slice(0, 10);
}

/** Dny, do kterých položka zasahuje (celodenní: UTC data, konec exkluzivní). */
export function itemDays(item: CalendarItem, maxDays = 62): string[] {
  const first = item.allDay ? item.start.slice(0, 10) : dayKey(item.start);
  let last = first;
  if (item.end) {
    last = item.allDay ? addDays(item.end.slice(0, 10), -1) : dayKey(item.end);
    if (last < first) last = first;
  }
  const days: string[] = [];
  for (let d = first; d <= last && days.length < maxDays; d = addDays(d, 1)) days.push(d);
  return days;
}

/** Měsíc z parametru `YYYY-MM`, jinak aktuální měsíc firmy. */
export function parseMonth(
  value: string | undefined,
  now: Date = new Date(),
): {
  year: number;
  month: number;
} {
  const m = /^(\d{4})-(\d{2})$/.exec(value ?? '');
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) {
    return { year: Number(m[1]), month: Number(m[2]) - 1 };
  }
  const [y, mo] = dayKey(now).split('-').map(Number);
  return { year: y, month: mo - 1 };
}

export function monthParam(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Týdny měsíční mřížky (pondělí–neděle), dny jako `YYYY-MM-DD`. */
export function monthGrid(year: number, month: number): string[][] {
  const first = new Date(Date.UTC(year, month, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const start = addDays(first.toISOString().slice(0, 10), -lead);
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const weeks = Math.ceil((lead + daysInMonth) / 7);
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)),
  );
}

/** Rozsah dotazu na API pro mřížku (s rezervou den na každou stranu kvůli zóně). */
export function gridRange(grid: string[][]): { from: string; to: string } {
  const first = grid[0][0];
  const last = grid[grid.length - 1][6];
  return {
    from: new Date(Date.parse(`${first}T00:00:00Z`) - DAY_MS).toISOString(),
    to: new Date(Date.parse(`${last}T00:00:00Z`) + 2 * DAY_MS).toISOString(),
  };
}

/** Položky rozdělené podle dnů (jen dny z `days`). */
export function itemsByDay(items: CalendarItem[], days: Set<string>): Map<string, CalendarItem[]> {
  const out = new Map<string, CalendarItem[]>();
  for (const item of items) {
    for (const d of itemDays(item)) {
      if (!days.has(d)) continue;
      const list = out.get(d) ?? [];
      list.push(item);
      out.set(d, list);
    }
  }
  return out;
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('cs-CZ', {
    timeZone: CALENDAR_TZ,
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function fmtDay(key: string): string {
  return new Date(`${key}T12:00:00Z`).toLocaleDateString('cs-CZ', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });
}

export function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('cs-CZ', {
    timeZone: CALENDAR_TZ,
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Čitelný čas položky („celý den“, „10:00–11:00“, „10:00“). */
export function fmtItemTime(item: CalendarItem): string {
  if (item.allDay) {
    const days = itemDays(item);
    return days.length > 1 ? `${fmtDay(days[0])} – ${fmtDay(days[days.length - 1])}` : 'celý den';
  }
  if (!item.end) return fmtTime(item.start);
  if (dayKey(item.start) === dayKey(item.end)) return `${fmtTime(item.start)}–${fmtTime(item.end)}`;
  return `${fmtDateTime(item.start)} – ${fmtDateTime(item.end)}`;
}
