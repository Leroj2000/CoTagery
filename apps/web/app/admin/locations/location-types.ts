/**
 * Typy míst ve webu: kategorie (Místo / Úložný prostor) a typy z číselníku firmy
 * (`GET /location-types` – systémové s přejmenováním/skrytím + vlastní) + label buňky.
 */
import {
  INTERNAL_LOCATION_TYPES,
  LOCATION_CATEGORY_LABELS,
  locationTypeName,
  type LocationCategory,
  type LocationTypeDef,
} from '@tagery/shared';

export type { LocationTypeDef };

export interface LocationTypeView extends LocationTypeDef {
  usage: number;
}

export const LOCATION_CATEGORIES = (
  Object.keys(LOCATION_CATEGORY_LABELS) as LocationCategory[]
).map((value) => ({ value, label: LOCATION_CATEGORY_LABELS[value] }));

/** Kategorie typu (neznámý / legacy typ = Místo). */
export function categoryOfType(types: LocationTypeDef[], key: string): LocationCategory {
  return (
    types.find((t) => t.key === key)?.category ?? INTERNAL_LOCATION_TYPES[key]?.category ?? 'place'
  );
}

/** Dělí se typ na mřížku buněk? */
export function isGridType(types: LocationTypeDef[], key: string): boolean {
  return types.find((t) => t.key === key)?.grid ?? false;
}

export function typeLabel(types: LocationTypeDef[], key: string): string {
  return locationTypeName(types, key);
}

/**
 * Typy k výběru v kategorii: bez skrytých; aktuální typ místa zůstane i když je
 * skrytý nebo neznámý (úprava místa o typ nepřijde).
 */
export function typeOptions(
  types: LocationTypeDef[],
  category: string,
  currentType?: string,
): { value: string; label: string }[] {
  const base = types
    .filter((t) => t.category === category && (!t.hidden || t.key === currentType))
    .map((t) => ({ value: t.key, label: t.name }));
  if (
    currentType &&
    !base.some((t) => t.value === currentType) &&
    category === categoryOfType(types, currentType)
  )
    return [{ value: currentType, label: typeLabel(types, currentType) }, ...base];
  return base;
}

/** Label buňky: řada = písmeno, sloupec = číslo → „A1" (shodné s backendem). */
export function cellLabel(row: number, col: number): string {
  const letter = row <= 26 ? String.fromCharCode(64 + row) : `R${row}`;
  return `${letter}${col}`;
}
