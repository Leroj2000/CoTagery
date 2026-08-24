import QRCode from 'qrcode';
import { LABEL_50X30 } from './niimbot-config';
import { PrinterError, type LabelData } from './types';

/**
 * Vykreslení štítku 384 × 240 px do canvasu a export jako PNG blob/object URL.
 *
 * Výstup je deterministický pro stejné vstupy (žádný čas/náhoda). Object URL si
 * volající po dotištění uvolní přes `revokeLabel` (sekce 5 zadání).
 *
 * Canvas i QR běží pouze na klientovi – funkce sahá na `document`/canvas až při
 * volání, nikoliv při importu, takže je bezpečná pro SSR.
 */

const PADDING = 8; // minimální vnitřní odsazení (sekce 7)
const QR_SIZE = 188; // QR vlevo, ~184–192 px (sekce 7)

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
 * Vykreslí štítek do canvasu 384 × 240 px, vloží QR + texty a vrátí object URL
 * PNG. QR se vykresluje jako ostrá matice (bez interpolace), s bílou klidovou
 * zónou a chybovou korekcí „M“.
 */
export async function renderLabel(data: LabelData): Promise<RenderedLabel> {
  if (typeof document === 'undefined') {
    throw new PrinterError('render-failed', 'Štítek se nepodařilo připravit.');
  }
  try {
    const { w_px, h_px } = LABEL_50X30;
    const canvas = document.createElement('canvas');
    canvas.width = w_px;
    canvas.height = h_px;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D kontext canvasu není dostupný.');

    // Bílé pozadí, černý obsah.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w_px, h_px);
    ctx.fillStyle = '#000000';
    ctx.imageSmoothingEnabled = false;

    // ── QR kód vlevo (ostrý, s klidovou zónou) ────────────────────────────────
    const qrCanvas = document.createElement('canvas');
    await QRCode.toCanvas(qrCanvas, data.qrValue, {
      errorCorrectionLevel: 'M',
      margin: 2, // bílá klidová zóna (moduly)
      scale: 1,
      color: { dark: '#000000', light: '#ffffff' },
    });
    const qrY = Math.round((h_px - QR_SIZE) / 2);
    // Nearest-neighbour škálování matice na cílovou velikost – bez rozmazání.
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(qrCanvas, PADDING, qrY, QR_SIZE, QR_SIZE);

    // ── Textový sloupec vpravo ────────────────────────────────────────────────
    const textX = PADDING + QR_SIZE + 12;
    const textW = w_px - textX - PADDING;

    // Název: max 3 řádky, tučné, dost velké písmo.
    const nameFont = 'bold 26px Arial, sans-serif';
    ctx.font = nameFont;
    ctx.textBaseline = 'top';
    const measure = (s: string): number => ctx.measureText(s).width;
    const nameLines = wrapText(data.itemName, textW, 3, measure);

    let y = PADDING + 6;
    const nameLineHeight = 30;
    for (const line of nameLines) {
      ctx.fillText(line, textX, y);
      y += nameLineHeight;
    }

    // Evidenční kód – výrazně pod názvem.
    y += 8;
    ctx.font = 'bold 22px "Courier New", monospace';
    ctx.fillText(data.assetCode, textX, y);

    // Nepovinný podtitulek u spodního okraje.
    if (data.subtitle && data.subtitle.trim()) {
      ctx.font = '16px Arial, sans-serif';
      ctx.textBaseline = 'bottom';
      ctx.fillText(clip(ctx, data.subtitle.trim(), textW), textX, h_px - PADDING);
    }

    const blob = await canvasToPngBlob(canvas);
    const url = URL.createObjectURL(blob);
    return {
      url,
      width: w_px,
      height: h_px,
      revoke: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    if (err instanceof PrinterError) throw err;
    throw new PrinterError('render-failed', 'Štítek se nepodařilo připravit.', err);
  }
}

/** Zkrátí jednořádkový text výpustkou, aby se vešel do šířky. */
function clip(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 0 && ctx.measureText(`${s}…`).width > maxWidth) {
    s = s.slice(0, -1);
  }
  return `${s}…`;
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('canvas.toBlob vrátil null'));
    }, 'image/png');
  });
}
