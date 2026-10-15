import {
  allDayRange,
  buildIcs,
  foldLine,
  generateShareToken,
  hashShareToken,
  isWellFormedToken,
  MAX_RANGE_DAYS,
  resolveRange,
  sortItems,
} from './calendar.logic';

describe('calendar.logic', () => {
  it('generuje nehádatelné tokeny ve správném tvaru', () => {
    const a = generateShareToken();
    const b = generateShareToken();
    expect(a).not.toBe(b);
    expect(isWellFormedToken(a)).toBe(true);
    expect(isWellFormedToken('abc')).toBe(false);
    expect(isWellFormedToken(`${a.slice(0, 42)}/`)).toBe(false);
  });

  it('hash tokenu je deterministický a token neobsahuje', () => {
    const t = generateShareToken();
    expect(hashShareToken(t)).toBe(hashShareToken(t));
    expect(hashShareToken(t)).toHaveLength(64);
    expect(hashShareToken(t)).not.toContain(t);
  });

  it('rozsah: výchozí, obrácený a příliš dlouhý', () => {
    const now = new Date('2026-10-15T10:00:00Z');
    const def = resolveRange(undefined, undefined, now);
    expect(def.from.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(def.to.toISOString()).toBe('2027-02-01T00:00:00.000Z');

    const flipped = resolveRange('2026-10-10', '2026-10-01', now);
    expect(flipped.to > flipped.from).toBe(true);

    const long = resolveRange('2020-01-01', '2030-01-01', now);
    expect((long.to.getTime() - long.from.getTime()) / 86_400_000).toBe(MAX_RANGE_DAYS);

    const garbage = resolveRange('nesmysl', undefined, now);
    expect(garbage.from.toISOString()).toBe(def.from.toISOString());
  });

  it('celodenní interval je [den, den+1)', () => {
    expect(allDayRange('2026-10-15')).toEqual({
      start: '2026-10-15T00:00:00.000Z',
      end: '2026-10-16T00:00:00.000Z',
    });
  });

  it('řadí podle začátku a názvu', () => {
    const items = sortItems([
      {
        id: 'b',
        source: 'event',
        title: 'B',
        start: '2026-10-02T00:00:00Z',
        end: null,
        allDay: false,
      },
      {
        id: 'a',
        source: 'event',
        title: 'A',
        start: '2026-10-01T00:00:00Z',
        end: null,
        allDay: false,
      },
    ]);
    expect(items.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('iCal: escapuje, zalamuje a nevkládá interní odkazy', () => {
    const ics = buildIcs(
      'Kalendář',
      [
        {
          id: 'event:1',
          source: 'event',
          title: 'Porada; sklad, vozy',
          start: '2026-10-15T08:00:00.000Z',
          end: '2026-10-15T09:00:00.000Z',
          allDay: false,
          description: 'řádek 1\nřádek 2',
          href: '/admin/secret',
        },
        {
          id: 'warranty:2',
          source: 'warranty',
          title: 'Konec záruky',
          start: '2026-10-20T00:00:00.000Z',
          end: '2026-10-21T00:00:00.000Z',
          allDay: true,
        },
      ],
      new Date('2026-10-15T10:00:00Z'),
    );
    expect(ics).toContain('BEGIN:VCALENDAR\r\n');
    expect(ics).toContain('SUMMARY:Porada\\; sklad\\, vozy');
    expect(ics).toContain('DESCRIPTION:řádek 1\\nřádek 2');
    expect(ics).toContain('DTSTART:20261015T080000Z');
    expect(ics).toContain('DTSTART;VALUE=DATE:20261020');
    expect(ics).toContain('DTEND;VALUE=DATE:20261021');
    expect(ics).toContain('UID:event:1@tagery');
    expect(ics).not.toContain('/admin/secret');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('zalamuje dlouhé řádky na max. 75 oktetů', () => {
    const folded = foldLine(`SUMMARY:${'ž'.repeat(100)}`);
    for (const part of folded.split('\r\n')) {
      expect(Buffer.byteLength(part, 'utf8')).toBeLessThanOrEqual(75);
    }
    expect(folded.replace(/\r\n /g, '')).toBe(`SUMMARY:${'ž'.repeat(100)}`);
  });
});
