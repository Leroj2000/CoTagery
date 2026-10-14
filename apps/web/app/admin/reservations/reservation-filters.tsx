'use client';

import { locationDescendants, type PlaceNode } from '../../lib/location-path';

/** Položka pro filtrování požadavků: kategorie + domovské místo. */
export interface AssetFacet {
  id: string;
  name: string;
  /** ID kategorie z číselníku, `text:<název>` u volného textu, `''` bez kategorie. */
  categoryKey: string;
  homeLocationId: string | null;
}

export interface FilterOption {
  value: string;
  label: string;
}

export const NO_CATEGORY = '__none__';

const selectCls = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm';

/**
 * Filtr položek podle kategorie a skladu. Sklad = domovské místo položky včetně
 * podřízených míst (Sklad → Regál → Police).
 */
export function makeAssetFilter(places: PlaceNode[]) {
  const cache = new Map<string, Set<string>>();
  return (asset: AssetFacet | undefined, category: string, location: string): boolean => {
    if (!asset) return !category && !location;
    if (
      category === NO_CATEGORY
        ? asset.categoryKey !== ''
        : category && asset.categoryKey !== category
    )
      return false;
    if (location) {
      let tree = cache.get(location);
      if (!tree) {
        tree = locationDescendants(location, places);
        tree.add(location);
        cache.set(location, tree);
      }
      if (!asset.homeLocationId || !tree.has(asset.homeLocationId)) return false;
    }
    return true;
  };
}

/** Výběr kategorie (vč. „bez kategorie"). */
export function CategorySelect({
  options,
  value,
  onChange,
  className = selectCls,
}: {
  options: FilterOption[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      aria-label="Kategorie"
    >
      <option value="">Všechny kategorie</option>
      {options.map((c) => (
        <option key={c.value} value={c.value}>
          {c.label}
        </option>
      ))}
      <option value={NO_CATEGORY}>— bez kategorie —</option>
    </select>
  );
}

/** Výběr skladu (domovské místo včetně podřízených). */
export function LocationSelect({
  options,
  value,
  onChange,
  className = selectCls,
}: {
  options: FilterOption[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
      aria-label="Sklad"
    >
      <option value="">Všechny sklady</option>
      {options.map((l) => (
        <option key={l.value} value={l.value}>
          {l.label}
        </option>
      ))}
    </select>
  );
}
