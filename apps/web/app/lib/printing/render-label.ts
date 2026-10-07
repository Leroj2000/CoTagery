import {
  DEFAULT_LABEL_FORMAT,
  defaultLabelTemplate,
  findLabelFormat,
  type LabelCell,
  type LabelFormat,
  type LabelTemplate,
} from '@tagery/shared';
import { PrinterError, type LabelData } from './types';
import {
  TENANT_LOGO_URL,
  drawBrandedQr,
  drawQrCaption,
  loadLogo,
  measureBrandedQr,
} from '../qr/branded-qr';

/**
 * Vykreslení štítku do canvasu a export jako PNG blob/object URL.
 *
 * Rozložení je pevné (QR vlevo s logem firmy a „by tagery.tech", vpravo sloupec
 * buněk), obsah a styl buněk určuje šablona z editoru štítků. Rozměr bitmapy
 * dává formát: Niimbot = přesné px tiskárny (203 DPI), arch A4 = 12 px/mm.
 *
 * Výstup je deterministický pro stejné vstupy (žádný čas/náhoda). Object URL si
 * volající po dotištění uvolní přes `revoke`. Canvas i QR běží pouze na
 * klientovi – funkce sahá na `document`/canvas až při volání (bezpečné pro SSR).
 */

/** Rozlišení pro archy A4 (≈ 305 DPI) – ostrý QR i text při tisku z prohlížeče. */
const SHEET_PX_PER_MM = 12;
/** Min. velikost modulu QR v px; když by ji logo nesplnilo, QR se vykreslí bez loga. */
const MIN_MODULE_PX_WITH_LOGO = 3;

/** Rozměr bitmapy štítku v px. */
export function labelPixelSize(format: LabelFormat): { w: number; h: number } {
  if (format.niimbot) return { w: format.niimbot.w_px, h: format.niimbot.h_px };
  return {
    w: Math.round(format.widthMm * SHEET_PX_PER_MM),
    h: Math.round(format.heightMm * SHEET_PX_PER_MM),
  };
}

/** Geometrie rozložení (čistá funkce – testovatelná bez canvasu). */
export function labelGeometry(w: number, h: number) {
  const pad = Math.max(4, Math.round(h * 0.033));
  const caption = Math.max(9, Math.round(h * 0.058));
  const qrMax = Math.max(40, Math.min(h - 2 * pad - caption - 2, Math.floor(w * 0.49)));
  // Základ písma: u vysokých štítků se neřídí výškou, ale šířkou textového sloupce.
  const base = Math.min(h, w * 0.625);
  const font = {
    S: Math.round(base * 0.067),
    M: Math.round(base * 0.092),
    L: Math.round(base * 0.115),
  };
  return { pad, caption, qrMax, font, gap: Math.max(6, Math.round(w * 0.031)) };
}

/** Text buňky pro konkrétní položku (prázdný řetězec = buňka se vynechá). */
export function labelCellValue(cell: LabelCell, data: LabelData): string {
  switch (cell.kind) {
    case 'name':
      return data.itemName;
    case 'code':
      return data.assetCode;
    case 'category':
      return data.category ?? '';
    case 'location':
      return data.location ?? '';
    case 'custom':
      return cell.text ?? '';
  }
}

export type RenderOptions = {
  /** Klíč formátu z katalogu (výchozí Niimbot 50 × 30). */
  formatKey?: string;
  /** Šablona buněk (výchozí šablona formátu). */
  template?: LabelTemplate | null;
};

/**
 * Zalomí text na daný počet řádků podle změřené šířky. Poslední povolený řádek
 * se v případě přetečení zkrátí výpustkou „…“. Čistá funkce – měření šířky se
 * předává jako callback (v testech lze mockovat).
 *
 * @returns pole řádků (max `maxLines`), případně s výpustkou na konci.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  maxLines: number,
  measure: (s: string) => number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];

  const lines: string[] = [];
  let current = '';

  const pushWord = (word: string): void => {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate) <= maxWidth || current === '') {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  };

  for (const word of words) {
    // Slovo delší než řádek rozdělíme po znacích, ať se vejde.
    if (measure(word) > maxWidth) {
      if (current) {
        lines.push(current);
        current = '';
      }
      let chunk = '';
      for (const ch of word) {
        const next = chunk + ch;
        if (measure(next) > maxWidth && chunk !== '') {
          lines.push(chunk);
          chunk = ch;
        } else {
          chunk = next;
        }
      }
      current = chunk;
      continue;
    }
    pushWord(word);
  }
  if (current) lines.push(current);

  if (lines.length <= maxLines) return lines;

  // Přetečení: omez řádky a poslední zkrať výpustkou.
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  const ellipsis = '…';
  while (last.length > 0 && measure(`${last}${ellipsis}`) > maxWidth) {
    last = last.slice(0, -1).trimEnd();
  }
  kept[maxLines - 1] = `${last}${ellipsis}`;
  return kept;
}

/** Výsledek vykreslení – object URL PNG + funkce na jeho uvolnění. */
export type RenderedLabel = {
  url: string;
  width: number;
  height: number;
  revoke: () => void;
};

/**
 * Vykreslí štítek podle formátu a šablony a vrátí object URL PNG. QR je ostrá
 * matice s celočíselnou velikostí modulu a klidovou zónou, s logem firmy
 * uprostřed (u Niimbotu černobíle) a „by tagery.tech" pod ním.
 */
export async function renderLabel(
  data: LabelData,
  { formatKey, template }: RenderOptions = {},
): Promise<RenderedLabel> {
  if (typeof document === 'undefined') {
    throw new PrinterError('render-failed', 'Štítek se nepodařilo připravit.');
  }
  try {
    const format = findLabelFormat(formatKey) ?? findLabelFormat(DEFAULT_LABEL_FORMAT)!;
    const cells =
      template && template.formatKey === format.key
        ? template.cells
        : defaultLabelTemplate(format.key).cells;
    const { w, h } = labelPixelSize(format);
    const g = labelGeometry(w, h);
    const thermal = format.kind === 'niimbot';

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D kontext canvasu není dostupný.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // ── QR vlevo + popisek, blok svisle vycentrovaný ──────────────────────────
    let logo = await loadLogo(data.logoUrl === undefined ? TENANT_LOGO_URL : data.logoUrl);
    // Čtení má přednost před logem: na malém štítku by korekce „H“ zhustila
    // matici pod čitelnou velikost modulu → vykresli QR bez loga.
    if (logo && measureBrandedQr(data.qrValue, g.qrMax, true).modulePx < MIN_MODULE_PX_WITH_LOGO) {
      logo = null;
    }
    const qrSize = measureBrandedQr(data.qrValue, g.qrMax, !!logo).size;
    const qrY = Math.max(g.pad, Math.round((h - (qrSize + 2 + g.caption)) / 2));
    const qr = drawBrandedQr(ctx, data.qrValue, {
      x: g.pad,
      y: qrY,
      maxSize: g.qrMax,
      logo,
      monochrome: thermal,
    });
    drawQrCaption(ctx, qr, g.pad, qrY + qr.size + 2, g.caption);

    // ── Sloupec buněk vpravo (shora dolů, co se nevejde, zkrátí se) ───────────
    const textX = g.pad + qr.size + g.gap;
    const textW = w - textX - g.pad;
    const bottom = h - g.pad;
    ctx.fillStyle = '#000000';
    ctx.textBaseline = 'top';
    const measure = (s: string): number => ctx.measureText(s).width;
    let y = g.pad + Math.round(g.font.S * 0.3);
    for (const cell of cells) {
      const value = labelCellValue(cell, data).trim();
      if (!value || textW < 20) continue;
      const px = g.font[cell.size];
      const lineH = Math.round(px * 1.15);
      const fits = Math.floor((bottom - y) / lineH);
      if (fits < 1) break;
      const family = cell.kind === 'code' ? '"Courier New", monospace' : 'Arial, sans-serif';
      ctx.font = `${cell.bold ? 'bold ' : ''}${px}px ${family}`;
      const lines = wrapText(value, textW, Math.min(cell.maxLines, fits), measure);
      for (const line of lines) {
        ctx.fillText(line, textX, y);
        y += lineH;
      }
      y += Math.round(px * 0.3);
    }

    const blob = await canvasToPngBlob(canvas);
    const url = URL.createObjectURL(blob);
    return { url, width: w, height: h, revoke: () => URL.revokeObjectURL(url) };
  } catch (err) {
    if (err instanceof PrinterError) throw err;
    throw new PrinterError('render-failed', 'Štítek se nepodařilo připravit.', err);
  }
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('canvas.toBlob vrátil null'));
    }, 'image/png');
  });
}
