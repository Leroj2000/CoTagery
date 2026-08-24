/**
 * Jediný zdroj konfigurace tiskárny NIIMBOT B1 a štítku 50 × 30 mm.
 * Žádná UI logika – jen hodnoty. Nevkládej stejné hodnoty na více míst.
 *
 * Hodnoty odpovídají sekci 4 zadání. Názvy vlastností jsou sladěné se skutečným
 * API knihovny `niimbot-web-bluetooth@2.4.0` (registry.json), aby je bylo možné
 * předat přímo do `Niimbot.printImage(url, { model, size })`.
 */

/**
 * Model B1 (203 DPI, task „b1“). `name_prefixes` filtruje Bluetooth chooser;
 * `task`/`dpi` slouží k ověření, že připojená tiskárna je opravdu B1 a ne B1 Pro
 * (ta má task „v4“ a 300 DPI).
 */
export const NIIMBOT_B1_MODEL = {
  name_prefixes: ['B1'],
  task: 'b1',
  /** Očekávané DPI B1 – použité k odmítnutí ne-B1 modelů. */
  dpi: 203,
  density: 3,
  label_type: 1,
  speed: 1,
} as const;

/** Štítek 50 × 30 mm pro B1: přesně 384 × 240 px, offset o 4 px dolů (paper registration). */
export const LABEL_50X30 = {
  widthMm: 50,
  heightMm: 30,
  w_px: 384,
  h_px: 240,
  offset_y_px: 4,
  /** DPI štítku – musí sedět s DPI tiskárny (jinak knihovna tisk odmítne). */
  dpi: 203,
} as const;

/** Výchozí tiskové parametry (sekce 3 zadání). */
export const PRINT_DEFAULTS = {
  density: 3,
  speed: 1,
  labelType: 1,
  copies: 1,
} as const;

/** Meze počtu kopií (sekce 5/13 zadání). */
export const COPIES_MIN = 1;
export const COPIES_MAX = 99;

export type NiimbotModelConfig = typeof NIIMBOT_B1_MODEL;
export type LabelConfig = typeof LABEL_50X30;
