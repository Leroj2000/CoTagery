/**
 * Sestaví tiskový štítek jako SVG (vektor = zdroj pravdy – fabrication.md):
 * QR kód + lidsky čitelný public_code pod ním.
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
    `<text x="150" y="292" font-family="monospace" font-size="18" text-anchor="middle" fill="#111111">${code}</text>`,
    '</svg>',
  ].join('');
}
