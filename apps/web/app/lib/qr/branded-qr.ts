import QRCode from 'qrcode';
import {
  QR_CAPTION,
  QR_ECC_PLAIN,
  QR_ECC_WITH_LOGO,
  inQrLogoHole,
  qrLogoBox,
  qrLogoHole,
} from '@tagery/shared';

/**
 * QR kód s logem firmy uprostřed pro canvas (štítky, klíčenka, štítek místa).
 * Geometrie otvoru je sdílená s API (`@tagery/shared` qr-logo), takže QR
 * z PDF/PNG ke stažení i z tiskárny vypadá stejně. Client-only.
 */

/** BFF proxy loga aktuální firmy (404 = firma logo nemá). */
export const TENANT_LOGO_URL = '/api/tenant-logo';

const logoCache = new Map<string, Promise<HTMLImageElement | null>>();

/** Načte obrázek (s cache per URL); při chybě/404 vrátí `null` – QR bude bez loga. */
export function loadLogo(url: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!url || typeof Image === 'undefined') return Promise.resolve(null);
  let p = logoCache.get(url);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img.naturalWidth > 0 ? img : null);
      img.onerror = () => resolve(null);
      img.src = url;
    });
    logoCache.set(url, p);
  }
  return p;
}

/** Zahodí cache loga (po nahrání/smazání v nastavení). */
export function invalidateLogoCache(): void {
  logoCache.clear();
}

export interface DrawQrOptions {
  /** Levý horní roh QR (vč. klidové zóny). */
  x: number;
  y: number;
  /** Max. strana v px – skutečná se zaokrouhlí dolů na celé moduly. */
  maxSize: number;
  logo?: HTMLImageElement | null;
  /** Klidová zóna v modulech. */
  margin?: number;
  /** Logo převést na čistě černobílé (termotisk – Niimbot tiskne 1bit). */
  monochrome?: boolean;
}

/** Rozměry QR bez kreslení (pro rozvržení štítku před vykreslením). */
export function measureBrandedQr(
  value: string,
  maxSize: number,
  hasLogo: boolean,
  margin = 2,
): { size: number; modulePx: number; margin: number } {
  const n = QRCode.create(value, {
    errorCorrectionLevel: hasLogo ? QR_ECC_WITH_LOGO : QR_ECC_PLAIN,
  }).modules.size;
  const total = n + 2 * margin;
  const m = Math.max(1, Math.floor(maxSize / total));
  return { size: total * m, modulePx: m, margin };
}

/**
 * Vykreslí QR s celočíselnou velikostí modulu (ostré, stejně široké moduly) a
 * případně logo do vyčištěného otvoru. S logem se použije korekce „H“.
 * @returns skutečná velikost QR v px a velikost modulu.
 */
export function drawBrandedQr(
  ctx: CanvasRenderingContext2D,
  value: string,
  { x, y, maxSize, logo = null, margin = 2, monochrome = false }: DrawQrOptions,
): { size: number; modulePx: number; margin: number } {
  const qr = QRCode.create(value, {
    errorCorrectionLevel: logo ? QR_ECC_WITH_LOGO : QR_ECC_PLAIN,
  });
  const n = qr.modules.size;
  const bits = qr.modules.data;
  const total = n + 2 * margin;
  const m = Math.max(1, Math.floor(maxSize / total));
  const size = total * m;
  const aspect = logo ? logo.naturalWidth / logo.naturalHeight : 1;
  const hole = logo ? qrLogoHole(n, aspect) : null;

  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = '#000000';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (bits[r * n + c] && !inQrLogoHole(hole, r, c)) {
        ctx.fillRect(x + (c + margin) * m, y + (r + margin) * m, m, m);
      }
    }
  }

  if (logo && hole) {
    const box = qrLogoBox(hole, aspect);
    const bx = Math.round(x + (box.x + margin) * m);
    const by = Math.round(y + (box.y + margin) * m);
    const bw = Math.max(1, Math.round(box.w * m));
    const bh = Math.max(1, Math.round(box.h * m));
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (monochrome) {
      ctx.drawImage(toMonochrome(logo, bw, bh), bx, by);
    } else {
      ctx.drawImage(logo, bx, by, bw, bh);
    }
  }
  ctx.restore();
  return { size, modulePx: m, margin };
}

/** Logo zmenšené na cílovou velikost a prahované na černou/bílou (průhledné → bílá). */
function toMonochrome(img: HTMLImageElement, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const cx = c.getContext('2d');
  if (!cx) return c;
  cx.imageSmoothingEnabled = true;
  cx.imageSmoothingQuality = 'high';
  cx.drawImage(img, 0, 0, w, h);
  const data = cx.getImageData(0, 0, w, h);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const dark = d[i + 3] >= 128 && lum < 160;
    const v = dark ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
    d[i + 3] = 255;
  }
  cx.putImageData(data, 0, 0);
  return c;
}

/**
 * Text „by tagery.tech" vlevo pod QR – zarovnaný k levé hraně modulů (za
 * klidovou zónou), jako popisek u vzoru „QR Platba".
 */
export function drawQrCaption(
  ctx: CanvasRenderingContext2D,
  qr: { size: number; modulePx: number; margin: number },
  x: number,
  y: number,
  fontPx: number,
): void {
  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.font = `bold ${fontPx}px Arial, Helvetica, sans-serif`;
  ctx.textBaseline = 'top';
  ctx.fillText(QR_CAPTION, x + qr.margin * qr.modulePx, y);
  ctx.restore();
}

/**
 * Samostatný obrázek QR (s logem a volitelně s popiskem) jako data URL – pro
 * `<img>` na obrazovce / tiskové stránky (klíčenka, štítek místa).
 */
export async function brandedQrDataUrl(
  value: string,
  sizePx: number,
  {
    logoUrl = TENANT_LOGO_URL,
    caption = true,
  }: { logoUrl?: string | null; caption?: boolean } = {},
): Promise<string> {
  const logo = await loadLogo(logoUrl);
  const fontPx = Math.max(10, Math.round(sizePx * 0.065));
  const captionH = caption ? Math.round(fontPx * 1.5) : 0;
  const canvas = document.createElement('canvas');
  canvas.width = sizePx;
  canvas.height = sizePx + captionH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D kontext canvasu není dostupný.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const qr = drawBrandedQr(ctx, value, { x: 0, y: 0, maxSize: sizePx, logo, margin: 2 });
  // Popisek až pod klidovou zónou – nesmí do ní zasahovat (čtení).
  if (caption) drawQrCaption(ctx, qr, 0, qr.size + 1, fontPx);
  return canvas.toDataURL('image/png');
}
