/**
 * Geometrie loga uprostřed QR kódu – sdílená API (PNG/SVG/PDF) i webem (canvas),
 * aby kód s logem vypadal a četl se všude stejně.
 *
 * Pravidla pro spolehlivé čtení:
 * - QR s logem se generuje s korekcí chyb „H“ (obnoví až ~30 % modulů),
 * - otvor pro logo (vč. bílého okraje) zabere max. ~11 % plochy matice,
 *   tj. zůstává velká rezerva na poškození/odlesk,
 * - otvor je zarovnaný na mřížku modulů a vycentrovaný, takže nikdy nezasáhne
 *   rohové hledací vzory ani klidovou zónu.
 */

/** Korekce chyb pro QR s logem / bez loga. */
export const QR_ECC_WITH_LOGO = 'H' as const;
export const QR_ECC_PLAIN = 'M' as const;

/** Text pod QR kódem na štítcích. */
export const QR_CAPTION = 'by tagery.tech';

/** Max. podíl strany matice, který smí otvor zabrat (delší strana). */
const MAX_SIDE_RATIO = 0.34;
/** Max. podíl plochy matice pro otvor. */
const MAX_AREA_RATIO = 0.11;

/** Otvor pro logo v modulech (x, y = levý horní roh v matici bez klidové zóny). */
export interface QrLogoHole {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Největší n ≤ max se stejnou paritou jako `count` (aby šel otvor přesně vycentrovat). */
function sameParity(max: number, count: number): number {
  let n = Math.max(1, Math.floor(max));
  if ((count - n) % 2 !== 0) n -= 1;
  return Math.max(1, n);
}

/**
 * Spočítá otvor pro logo v QR matici o `moduleCount` modulech na stranu.
 * `logoAspect` = šířka / výška loga – otvor kopíruje poměr stran (obdélníkové
 * logo dostane obdélníkový otvor jako na vzoru), ale vždy v mezích plochy.
 */
export function qrLogoHole(moduleCount: number, logoAspect = 1): QrLogoHole {
  const aspect = Number.isFinite(logoAspect) && logoAspect > 0 ? logoAspect : 1;
  const maxSide = moduleCount * MAX_SIDE_RATIO;
  const maxArea = moduleCount * moduleCount * MAX_AREA_RATIO;

  // Startovní rozměr podle delší strany, pak zmenšuj, dokud se nevejde do plochy.
  let w = aspect >= 1 ? maxSide : maxSide * aspect;
  let h = aspect >= 1 ? maxSide / aspect : maxSide;
  const area = w * h;
  if (area > maxArea) {
    const k = Math.sqrt(maxArea / area);
    w *= k;
    h *= k;
  }
  // Minimum 5 modulů (jinak by logo nebylo čitelné), maximum tak, aby otvor
  // zůstal mimo rohové hledací vzory (7 modulů + 1 oddělovač z každé strany).
  const limit = Math.max(1, moduleCount - 16);
  const W = sameParity(Math.min(Math.max(w, 5), limit), moduleCount);
  const H = sameParity(Math.min(Math.max(h, 5), limit), moduleCount);
  return { x: (moduleCount - W) / 2, y: (moduleCount - H) / 2, w: W, h: H };
}

/** Leží modul (řádek, sloupec) v otvoru pro logo? */
export function inQrLogoHole(hole: QrLogoHole | null, row: number, col: number): boolean {
  return (
    !!hole && col >= hole.x && col < hole.x + hole.w && row >= hole.y && row < hole.y + hole.h
  );
}

/**
 * Obdélník, do kterého se logo vykreslí (v modulech, uvnitř otvoru): otvor
 * zmenšený o 1 modul bílého okraje z každé strany a logo vepsané se zachováním
 * poměru stran.
 */
export function qrLogoBox(
  hole: QrLogoHole,
  logoAspect = 1,
): { x: number; y: number; w: number; h: number } {
  const pad = 1;
  const bw = Math.max(1, hole.w - 2 * pad);
  const bh = Math.max(1, hole.h - 2 * pad);
  const aspect = Number.isFinite(logoAspect) && logoAspect > 0 ? logoAspect : 1;
  let w = bw;
  let h = bw / aspect;
  if (h > bh) {
    h = bh;
    w = bh * aspect;
  }
  return { x: hole.x + pad + (bw - w) / 2, y: hole.y + pad + (bh - h) / 2, w, h };
}
