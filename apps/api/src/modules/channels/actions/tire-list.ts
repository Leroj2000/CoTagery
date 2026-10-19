import { TIRE_AXLE_LABELS, TIRE_SEASON_LABELS, formatTireSize } from '@tagery/shared';
import type { AssetTire } from '../../asset/entities/asset-tire.entity';

/** Řádek nápravy v odpovědi `tire.list`. */
export interface TireRowOut {
  axle: string;
  axleLabel: string;
  size: string;
  brand: string | null;
  dot: string | null;
  treadDepthMm: number | null;
  quantity: number;
  note: string | null;
}

/** Sada pneumatik v odpovědi `tire.list`. */
export interface TireSetOut {
  setLabel: string;
  season: string;
  seasonLabel: string;
  mounted: boolean;
  /** Kde je sada uskladněná – jen u nenamontovaných sad. */
  storedLocation: string | null;
  rows: TireRowOut[];
}

const AXLE_ORDER: Record<string, number> = { front: 0, rear: 1, all: 2 };

/**
 * Čistá funkce: řádky z TiresService → sady pro kanály (namontovaná první).
 * Bez interních id a tenant údajů.
 */
export function buildTireSets(rows: AssetTire[], locationNames: Map<string, string>): TireSetOut[] {
  const sets = new Map<string, TireSetOut>();
  const sorted = [...rows].sort((a, b) => (AXLE_ORDER[a.axle] ?? 9) - (AXLE_ORDER[b.axle] ?? 9));
  for (const r of sorted) {
    let set = sets.get(r.setLabel);
    if (!set) {
      set = {
        setLabel: r.setLabel,
        season: r.season,
        seasonLabel: TIRE_SEASON_LABELS[r.season] ?? r.season,
        mounted: false,
        storedLocation: null,
        rows: [],
      };
      sets.set(r.setLabel, set);
    }
    set.mounted ||= r.mounted;
    if (!set.storedLocation && r.storedLocationId) {
      set.storedLocation = locationNames.get(r.storedLocationId) ?? null;
    }
    set.rows.push({
      axle: r.axle,
      axleLabel: TIRE_AXLE_LABELS[r.axle] ?? r.axle,
      size: formatTireSize(r),
      brand: r.brand ?? null,
      dot: r.dot ?? null,
      treadDepthMm: r.treadDepthMm ?? null,
      quantity: r.quantity,
      note: r.note ?? null,
    });
  }
  const out = [...sets.values()];
  for (const s of out) if (s.mounted) s.storedLocation = null;
  return out.sort(
    (a, b) => Number(b.mounted) - Number(a.mounted) || a.setLabel.localeCompare(b.setLabel, 'cs'),
  );
}
