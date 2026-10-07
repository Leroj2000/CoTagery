import { findLabelFormat, type LabelTemplate } from '@tagery/shared';
import { renderLabel } from './render-label';
import { PrinterError, type LabelData } from './types';

/**
 * Pozice štítku na archu (v mm od levého horního rohu) pro pořadí `index`
 * (0 = první štítek prvního archu, řádek po řádku).
 */
export function sheetSlot(
  formatKey: string,
  index: number,
): { page: number; leftMm: number; topMm: number } {
  const format = findLabelFormat(formatKey);
  const s = format?.sheet;
  if (!format || !s) throw new Error(`Formát ${formatKey} není arch.`);
  const perPage = s.cols * s.rows;
  const page = Math.floor(index / perPage);
  const slot = index % perPage;
  const row = Math.floor(slot / s.cols);
  const col = slot % s.cols;
  return {
    page,
    leftMm: s.marginLeftMm + col * (format.widthMm + s.gapXMm),
    topMm: s.marginTopMm + row * (format.heightMm + s.gapYMm),
  };
}

/**
 * Vytiskne štítky na arch A4 přes systémový tisk prohlížeče. Štítky se vykreslí
 * stejně jako náhled a umístí v mm do skrytého iframe. `start` (od 1) dovolí
 * dotisknout načatý arch.
 */
export async function printSheet(
  data: LabelData,
  {
    formatKey,
    template,
    copies,
    start,
  }: {
    formatKey: string;
    template: LabelTemplate | null;
    copies: number;
    start: number;
  },
): Promise<void> {
  const format = findLabelFormat(formatKey);
  if (!format?.sheet) throw new PrinterError('render-failed', 'Zvolený formát není arch A4.');
  const rendered = await renderLabel(data, { formatKey, template });

  const pages = new Map<number, string[]>();
  for (let i = 0; i < copies; i++) {
    const { page, leftMm, topMm } = sheetSlot(formatKey, start - 1 + i);
    const imgs = pages.get(page) ?? [];
    imgs.push(
      `<img src="${rendered.url}" style="left:${leftMm}mm;top:${topMm}mm;width:${format.widthMm}mm;height:${format.heightMm}mm" alt="">`,
    );
    pages.set(page, imgs);
  }
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { size: A4; margin: 0; }
    html, body { margin: 0; padding: 0; }
    .sheet { position: relative; width: 210mm; height: 297mm; overflow: hidden; break-after: page; }
    .sheet:last-child { break-after: auto; }
    img { position: absolute; display: block; }
  </style></head><body>${[...pages.values()]
    .map((imgs) => `<div class="sheet">${imgs.join('')}</div>`)
    .join('')}</body></html>`;

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);
  const cleanup = () => {
    iframe.remove();
    rendered.revoke();
  };
  try {
    await new Promise<void>((resolve) => {
      iframe.onload = () => resolve();
      iframe.srcdoc = html;
    });
    const doc = iframe.contentDocument;
    const win = iframe.contentWindow;
    if (!doc || !win) throw new Error('Tiskový rámec není dostupný.');
    await Promise.all(
      [...doc.images].map((img) =>
        img.complete ? Promise.resolve() : new Promise((r) => (img.onload = img.onerror = r)),
      ),
    );
    win.addEventListener('afterprint', () => setTimeout(cleanup, 0), { once: true });
    win.focus();
    win.print();
    // Pojistka pro prohlížeče bez afterprint (iOS Safari).
    setTimeout(cleanup, 60_000);
  } catch (err) {
    cleanup();
    throw new PrinterError('print-failed', 'Arch se nepodařilo připravit k tisku.', err);
  }
}
