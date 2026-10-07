import { QR_CAPTION } from '@tagery/shared';

/**
 * Sestaví tiskový štítek jako SVG (vektor = zdroj pravdy – fabrication.md):
 * QR kód (s logem firmy) + „by tagery.tech" vlevo pod ním + lidsky čitelný
 * public_code.
 */
export function buildLabelSvg(qrSvg: string, code: string): string {
  // Vloží QR SVG jako vnořený <svg> se souřadnicemi/rozměry (vlastní viewBox škáluje).
  const nested = qrSvg.replace(
    /^<svg /,
    '<svg x="30" y="24" width="240" height="240" ',
  );
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="320" viewBox="0 0 300 320">',
    '<rect width="300" height="320" fill="#ffffff"/>',
    nested,
    `<text x="30" y="280" font-family="Arial, Helvetica, sans-serif" font-size="11" font-weight="700" fill="#111111">${QR_CAPTION}</text>`,
    `<text x="150" y="306" font-family="monospace" font-size="18" text-anchor="middle" fill="#111111">${code}</text>`,
    '</svg>',
  ].join('');
}
