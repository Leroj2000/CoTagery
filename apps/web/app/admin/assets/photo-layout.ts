/**
 * Rozložení galerie fotek na detailu položky (čisté funkce → testovatelné).
 *
 * - Mobil/tablet: hlavní fotka přes celou šířku, náhledy pod ní (3–4 v řadě).
 * - Desktop (lg): hlavní fotka zabírá polovinu galerie (2 ze 4 sloupců, 2 řádky)
 *   a ostatní fotky jsou vedle ní v mřížce 2 × N – vše viditelné najednou.
 * Ovládací lišta je vždy pod fotkou (nikdy přes ni).
 */
export const PHOTO_GRID_CLASS = 'grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-4';

export function photoTileClass(index: number): string {
  const base = 'group flex flex-col overflow-hidden rounded-xl border border-slate-200';
  return index === 0 ? `${base} col-span-full lg:col-span-2 lg:row-span-2` : base;
}

export function photoImageClass(index: number): string {
  const base = 'w-full bg-slate-100 object-contain transition-transform';
  return index === 0 ? `${base} aspect-[4/3] max-h-[460px] lg:max-h-none` : `${base} aspect-square`;
}
