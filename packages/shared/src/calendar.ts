/**
 * Kalendář firmy – sdílené typy a číselník zdrojů událostí (API skládá, web
 * zobrazuje). Událost je buď ručně založená (`event`), nebo odvozená z jiné
 * evidence (rezervace, vrácení výpůjčky, servis/STK, konec záruky, inventura).
 */

export const CALENDAR_SOURCES = [
  'event',
  'reservation',
  'loan',
  'service',
  'warranty',
  'inventory',
  'tire_slot',
] as const;
export type CalendarSource = (typeof CALENDAR_SOURCES)[number];

export const CALENDAR_SOURCE_LABELS: Record<CalendarSource, string> = {
  event: 'Události',
  reservation: 'Rezervace',
  loan: 'Vrácení výpůjček',
  service: 'Servis a revize',
  warranty: 'Konce záruk',
  inventory: 'Inventury',
  tire_slot: 'Přezutí pneumatik',
};

/** Oprávnění potřebné k zobrazení zdroje (v kalendáři i při sdílení). */
export const CALENDAR_SOURCE_PERMISSIONS: Record<CalendarSource, string> = {
  event: 'core.calendar.view',
  reservation: 'asset.reservation.view',
  loan: 'asset.item.view',
  service: 'asset.item.view',
  warranty: 'asset.purchase.view',
  inventory: 'asset.inventory.manage',
  tire_slot: 'asset.tireslot.book',
};

export function isCalendarSource(value: string): value is CalendarSource {
  return (CALENDAR_SOURCES as readonly string[]).includes(value);
}

/** Položka kalendáře (sjednocený tvar pro všechny zdroje). */
export interface CalendarItem {
  /** Stabilní id napříč zdroji, např. `reservation:<uuid>` (UID v iCal). */
  id: string;
  source: CalendarSource;
  title: string;
  /** ISO čas začátku; u celodenních událostí půlnoc daného dne (UTC). */
  start: string;
  /** ISO čas konce (u celodenních exkluzivně následující den); null = bod v čase. */
  end: string | null;
  allDay: boolean;
  description?: string | null;
  location?: string | null;
  /** Odkaz do administrace (jen v přihlášeném kalendáři, nikdy ve veřejném). */
  href?: string | null;
}

/** Ručně založená událost (CRUD v administraci). */
export interface CalendarEventDto {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
}

/** Sdílecí odkaz – token se vrací jen jednou při založení. */
export interface CalendarShareDto {
  id: string;
  label: string | null;
  sources: CalendarSource[];
  expiresAt: string | null;
  revokedAt: string | null;
  lastAccessedAt: string | null;
  createdAt: string;
}

/** Veřejná odpověď pro sdílený kalendář – nic navíc mimo události. */
export interface PublicCalendar {
  title: string;
  items: CalendarItem[];
}
