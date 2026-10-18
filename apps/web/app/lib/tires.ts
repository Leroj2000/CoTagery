import { formatTireSize, type AssetTireView, type TireSeason } from '@tagery/shared';

export interface TireSet {
  label: string;
  season: TireSeason;
  mounted: boolean;
  rows: AssetTireView[];
}

const AXLE_ORDER = { front: 0, rear: 1, all: 2 } as const;

/** Seskupí řádky do sad (podle názvu); namontovaná sada první, nápravy přední→zadní. */
export function groupTireSets(rows: AssetTireView[]): TireSet[] {
  const map = new Map<string, TireSet>();
  for (const r of rows) {
    const set = map.get(r.setLabel) ?? {
      label: r.setLabel,
      season: r.season,
      mounted: false,
      rows: [],
    };
    set.mounted ||= r.mounted;
    set.rows.push(r);
    map.set(r.setLabel, set);
  }
  const sets = [...map.values()];
  for (const s of sets) s.rows.sort((a, b) => AXLE_ORDER[a.axle] - AXLE_ORDER[b.axle]);
  return sets.sort(
    (a, b) => Number(b.mounted) - Number(a.mounted) || a.label.localeCompare(b.label, 'cs'),
  );
}

/** Rozměr namontované sady do hlavičky (různé nápravy oddělené „ / “), jinak null. */
export function mountedTireSummary(rows: AssetTireView[]): string | null {
  const mounted = groupTireSets(rows).find((s) => s.mounted);
  if (!mounted) return null;
  return [...new Set(mounted.rows.map((r) => formatTireSize(r)))].join(' / ');
}

/** Sekce Pneumatiky jen u vozidel a strojů. */
export function showsTires(equipmentKind: string | null | undefined): boolean {
  return equipmentKind === 'vehicle' || equipmentKind === 'machine';
}
