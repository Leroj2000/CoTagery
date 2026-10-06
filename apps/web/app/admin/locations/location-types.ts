/** Sdílené definice kategorií/typů míst (dvoukrokový výběr) + label buňky. */

export const LOCATION_CATEGORIES = [
  { value: 'place', label: 'Místo' },
  { value: 'storage', label: 'Úložný prostor' },
];

export const LOCATION_TYPES_BY_CATEGORY: Record<string, { value: string; label: string }[]> = {
  place: [
    { value: 'city', label: 'Město' },
    { value: 'street', label: 'Ulice' },
    { value: 'building', label: 'Budova' },
    { value: 'room', label: 'Místnost' },
    { value: 'warehouse', label: 'Sklad' },
    { value: 'store', label: 'Prodejna' },
    { value: 'venue', label: 'Místo konání' },
    { value: 'office', label: 'Kancelář' },
    { value: 'home', label: 'Domov' },
  ],
  storage: [
    { value: 'box', label: 'Úložný box' },
    { value: 'shelf', label: 'Police' },
    { value: 'rack', label: 'Regál' },
    { value: 'cabinet', label: 'Skříň' },
  ],
};

/** Typy s mřížkovým rozdělením na sekce. */
export const GRID_TYPES = new Set(['rack', 'cabinet']);

export function categoryOfType(type: string): string {
  return ['rack', 'cabinet', 'box', 'shelf'].includes(type) ? 'storage' : 'place';
}

/** Typy pro danou kategorii; zachová i neznámý (legacy) aktuální typ. */
export function typeOptionsFor(
  category: string,
  currentType?: string,
): { value: string; label: string }[] {
  const base = LOCATION_TYPES_BY_CATEGORY[category] ?? [];
  if (currentType && !base.some((t) => t.value === currentType)) {
    return [{ value: currentType, label: currentType }, ...base];
  }
  return base;
}

/** Label buňky: řada = písmeno, sloupec = číslo → „A1" (shodné s backendem). */
export function cellLabel(row: number, col: number): string {
  const letter = row <= 26 ? String.fromCharCode(64 + row) : `R${row}`;
  return `${letter}${col}`;
}
