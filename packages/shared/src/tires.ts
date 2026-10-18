/** Pneumatiky položky (vozidla a stroje) – sdílené typy API ↔ web. */
export const TIRE_SEASONS = [
  'summer',
  'winter',
  'all_season',
  'construction',
  'industrial',
] as const;
export type TireSeason = (typeof TIRE_SEASONS)[number];

export const TIRE_AXLES = ['front', 'rear', 'all'] as const;
export type TireAxle = (typeof TIRE_AXLES)[number];

export const TIRE_CONSTRUCTIONS = ['R', 'D'] as const;
export type TireConstruction = (typeof TIRE_CONSTRUCTIONS)[number];

export const TIRE_SEASON_LABELS: Record<TireSeason, string> = {
  summer: 'Letní',
  winter: 'Zimní',
  all_season: 'Celoroční',
  construction: 'Stavební',
  industrial: 'Průmyslové',
};

export const TIRE_AXLE_LABELS: Record<TireAxle, string> = {
  front: 'Přední náprava',
  rear: 'Zadní náprava',
  all: 'Všechna kola',
};

/** Řádek pneumatik jedné nápravy v sadě (odpověď API). */
export interface AssetTireView {
  id: string;
  assetId: string;
  setLabel: string;
  season: TireSeason;
  axle: TireAxle;
  width: number;
  aspectRatio: number | null;
  rimDiameter: number;
  construction: TireConstruction;
  loadIndex: string | null;
  speedIndex: string | null;
  brand: string | null;
  dot: string | null;
  treadDepthMm: number | null;
  quantity: number;
  mounted: boolean;
  storedLocationId: string | null;
  note: string | null;
}

/**
 * Rozměr ve tvaru „205/55 R16 91V“ (bez profilu: „7.50 R16“ → „750 R16“ dle šířky).
 * Ráfek s desetinou (např. 22.5) se vypíše s tečkou.
 */
export function formatTireSize(
  t: Pick<
    AssetTireView,
    'width' | 'aspectRatio' | 'rimDiameter' | 'construction' | 'loadIndex' | 'speedIndex'
  >,
): string {
  const rim = Number(t.rimDiameter);
  const rimText = String(rim);
  const head = t.aspectRatio != null ? `${t.width}/${t.aspectRatio}` : `${t.width}`;
  const service = `${t.loadIndex ?? ''}${t.speedIndex ?? ''}`.trim();
  return `${head} ${t.construction}${rimText}${service ? ` ${service}` : ''}`;
}
