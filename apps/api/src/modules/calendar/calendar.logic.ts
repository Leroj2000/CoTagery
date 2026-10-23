import { createHash, randomBytes } from 'node:crypto';
import type { CalendarItem } from '@tagery/shared';

/** Max. rozsah jednoho dotazu na kalendář (ochrana DB i veřejného endpointu). */
export const MAX_RANGE_DAYS = 400;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Náhodný token sdílecího odkazu (256 bitů, base64url – 43 znaků). */
export function generateShareToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Hash tokenu pro uložení/vyhledání (token samotný se neukládá). */
export function hashShareToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Formálně platný token (rychlé odmítnutí nesmyslů před dotazem do DB). */
export function isWellFormedToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

/**
 * Rozsah dotazu: výchozí od začátku minulého měsíce do konce za 3 měsíce,
 * neplatné/obrácené hodnoty odmítne, příliš dlouhý rozsah ořízne.
 */
export function resolveRange(
  from: string | undefined,
  to: string | undefined,
  now: Date = new Date(),
): { from: Date; to: Date } {
  const defFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const defTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 4, 1));
  let f = from ? new Date(from) : defFrom;
  let t = to ? new Date(to) : defTo;
  if (!Number.isFinite(f.getTime())) f = defFrom;
  if (!Number.isFinite(t.getTime())) t = defTo;
  if (t <= f) t = new Date(f.getTime() + 31 * DAY_MS);
  if (t.getTime() - f.getTime() > MAX_RANGE_DAYS * DAY_MS) {
    t = new Date(f.getTime() + MAX_RANGE_DAYS * DAY_MS);
  }
  return { from: f, to: t };
}

/** `YYYY-MM-DD` (sloupec typu date) → celodenní interval [den, den+1). */
export function allDayRange(day: string): { start: string; end: string } {
  const start = new Date(`${day.slice(0, 10)}T00:00:00.000Z`);
  return {
    start: start.toISOString(),
    end: new Date(start.getTime() + DAY_MS).toISOString(),
  };
}

/** Seřadí položky podle začátku, pak názvu (stabilní výstup pro UI i iCal). */
export function sortItems(items: CalendarItem[]): CalendarItem[] {
  return [...items].sort(
    (a, b) => a.start.localeCompare(b.start) || a.title.localeCompare(b.title, 'cs'),
  );
}

// --- iCalendar (RFC 5545) ---

export function icsEscape(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Zalomení řádků na 75 oktetů (pokračování začíná mezerou). */
export function foldLine(line: string): string {
  const out: string[] = [];
  let current = '';
  let bytes = 0;
  for (const ch of line) {
    const size = Buffer.byteLength(ch, 'utf8');
    const limit = out.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      out.push(current);
      current = '';
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  out.push(current);
  return out.join('\r\n ');
}

function icsDateTime(iso: string): string {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

function icsDate(iso: string): string {
  return iso.slice(0, 10).replace(/-/g, '');
}

/** Sestaví iCal feed. `href` se do feedu záměrně nevkládá (interní odkazy). */
export function buildIcs(title: string, items: CalendarItem[], now: Date = new Date()): string {
  const stamp = icsDateTime(now.toISOString());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tagery//Kalendar//CS',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsEscape(title)}`,
    'X-PUBLISHED-TTL:PT1H',
  ];
  for (const item of items) {
    lines.push('BEGIN:VEVENT', `UID:${item.id}@tagery`, `DTSTAMP:${stamp}`);
    if (item.allDay) {
      lines.push(`DTSTART;VALUE=DATE:${icsDate(item.start)}`);
      if (item.end) lines.push(`DTEND;VALUE=DATE:${icsDate(item.end)}`);
    } else {
      lines.push(`DTSTART:${icsDateTime(item.start)}`);
      if (item.end) lines.push(`DTEND:${icsDateTime(item.end)}`);
    }
    lines.push(`SUMMARY:${icsEscape(item.title)}`);
    if (item.description) lines.push(`DESCRIPTION:${icsEscape(item.description)}`);
    if (item.location) lines.push(`LOCATION:${icsEscape(item.location)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).join('\r\n') + '\r\n';
}
