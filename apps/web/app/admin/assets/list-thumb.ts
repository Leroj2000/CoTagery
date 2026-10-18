/**
 * Náhled fotky v seznamu položek. Nesmí se schovat na žádné šířce: buňka má
 * pevnou min. šířku a obrázek `shrink-0`, takže ho široká tabulka v
 * `overflow-x-auto` nezmáčkne na 0 px (dřív se na mobilu na výšku „ztratil“).
 */
export const LIST_THUMB_PX = 40;
export const LIST_THUMB_CELL_CLASS = 'w-12 min-w-12 py-2.5 pr-2';
export const LIST_THUMB_CLASS =
  'h-10 w-10 min-w-10 shrink-0 rounded-lg border border-slate-200 object-cover';
export const LIST_THUMB_PLACEHOLDER_CLASS =
  'flex h-10 w-10 min-w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400';
