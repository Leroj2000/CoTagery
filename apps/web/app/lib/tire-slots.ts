import { TIRE_SLOT_SEASON_LABELS, type TireSlotSeason } from '@tagery/shared';
import { CALENDAR_TZ } from './calendar';

const day = new Intl.DateTimeFormat('cs-CZ', {
  timeZone: CALENDAR_TZ,
  weekday: 'short',
  day: 'numeric',
  month: 'numeric',
});
const time = new Intl.DateTimeFormat('cs-CZ', {
  timeZone: CALENDAR_TZ,
  hour: 'numeric',
  minute: '2-digit',
});

/** „po 26. 10. 8:00–8:30“ (čas firmy). */
export function fmtSlot(startsAt: string, endsAt: string): string {
  const s = new Date(startsAt);
  return `${day.format(s)} ${time.format(s)}–${time.format(new Date(endsAt))}`;
}

/** Krátký popisek tlačítka: „po 26. 10. 8:00“. */
export function fmtSlotShort(startsAt: string): string {
  const s = new Date(startsAt);
  return `${day.format(s)} ${time.format(s)}`;
}

export function seasonLabel(season: TireSlotSeason | null): string | null {
  return season ? `Přezutí ${TIRE_SLOT_SEASON_LABELS[season]}` : null;
}

export const CUTOFF_NOTE =
  'Rezervovat, změnit nebo zrušit termín jde nejpozději 24 h před jeho začátkem.';
