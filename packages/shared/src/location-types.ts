/**
 * Typy míst. Systémové typy jsou základ (firma je smí přejmenovat nebo skrýt,
 * ne smazat), vlastní typy si firma zakládá sama (`c_…`). Uloženo per firma
 * v `location_types` (přepsání systémových + vlastní); efektivní seznam = sloučení.
 */

export type LocationCategory = 'place' | 'storage';

export interface LocationTypeDef {
  key: string;
  name: string;
  category: LocationCategory;
  /** Dělí se na mřížku buněk (A1, A2…) – regál, skříň. */
  grid: boolean;
  hidden: boolean;
  system: boolean;
  sortOrder: number;
}

export const LOCATION_CATEGORY_LABELS: Record<LocationCategory, string> = {
  place: 'Místo',
  storage: 'Úložný prostor',
};

export const SYSTEM_LOCATION_TYPES: Omit<LocationTypeDef, 'hidden'>[] = [
  { key: 'city', name: 'Město', category: 'place', grid: false, system: true, sortOrder: 10 },
  { key: 'street', name: 'Ulice', category: 'place', grid: false, system: true, sortOrder: 20 },
  { key: 'building', name: 'Budova', category: 'place', grid: false, system: true, sortOrder: 30 },
  { key: 'room', name: 'Místnost', category: 'place', grid: false, system: true, sortOrder: 40 },
  { key: 'warehouse', name: 'Sklad', category: 'place', grid: false, system: true, sortOrder: 50 },
  { key: 'store', name: 'Prodejna', category: 'place', grid: false, system: true, sortOrder: 60 },
  {
    key: 'venue',
    name: 'Místo konání',
    category: 'place',
    grid: false,
    system: true,
    sortOrder: 70,
  },
  { key: 'office', name: 'Kancelář', category: 'place', grid: false, system: true, sortOrder: 80 },
  { key: 'home', name: 'Domov', category: 'place', grid: false, system: true, sortOrder: 90 },
  {
    key: 'box',
    name: 'Úložný box',
    category: 'storage',
    grid: false,
    system: true,
    sortOrder: 110,
  },
  { key: 'shelf', name: 'Police', category: 'storage', grid: false, system: true, sortOrder: 120 },
  { key: 'rack', name: 'Regál', category: 'storage', grid: true, system: true, sortOrder: 130 },
  { key: 'cabinet', name: 'Skříň', category: 'storage', grid: true, system: true, sortOrder: 140 },
];

/** Interní typy (nevybírají se v nastavení): buňka mřížky, přístupový bod. */
export const INTERNAL_LOCATION_TYPES: Record<string, { name: string; category: LocationCategory }> =
  {
    cell: { name: 'Buňka', category: 'storage' },
    access_point: { name: 'Přístupový bod', category: 'place' },
  };

export interface LocationTypeOverride {
  key: string;
  name: string | null;
  category: LocationCategory | null;
  grid: boolean | null;
  hidden: boolean;
  sortOrder: number | null;
}

/** Efektivní typy firmy: systémové s přepsáním + vlastní, seřazené. */
export function mergeLocationTypes(rows: LocationTypeOverride[]): LocationTypeDef[] {
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const system = SYSTEM_LOCATION_TYPES.map((t) => {
    const o = byKey.get(t.key);
    return {
      ...t,
      name: o?.name?.trim() || t.name,
      hidden: o?.hidden ?? false,
      sortOrder: o?.sortOrder ?? t.sortOrder,
    };
  });
  const systemKeys = new Set(SYSTEM_LOCATION_TYPES.map((t) => t.key));
  const custom = rows
    .filter((r) => !systemKeys.has(r.key) && !INTERNAL_LOCATION_TYPES[r.key])
    .map((r) => ({
      key: r.key,
      name: r.name?.trim() || r.key,
      category: r.category ?? 'place',
      grid: r.grid ?? false,
      hidden: r.hidden,
      system: false,
      sortOrder: r.sortOrder ?? 1000,
    }));
  return [...system, ...custom].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'cs'),
  );
}

/** Název typu (i interního / neznámého). */
export function locationTypeName(types: LocationTypeDef[], key: string | null | undefined): string {
  if (!key) return '—';
  return types.find((t) => t.key === key)?.name ?? INTERNAL_LOCATION_TYPES[key]?.name ?? key;
}
