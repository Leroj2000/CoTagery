import { LABEL_FORMATS, findLabelFormat } from '@tagery/shared';
import { labelCellValue, labelGeometry, labelPixelSize } from '../render-label';
import { sheetSlot } from '../print-sheet';
import { measureBrandedQr } from '../../qr/branded-qr';
import { QR_MARGIN_MODULES } from '../render-label';

describe('rozložení štítku', () => {
  it('Niimbot 50 × 30: 384 × 240, QR smí zabrat celou výšku sekce (208 px)', () => {
    const { w, h } = labelPixelSize(findLabelFormat('niimbot-50x30')!);
    expect([w, h]).toEqual([384, 240]);
    const g = labelGeometry(w, h);
    expect(g.qrMax).toBe(208);
    expect(g.font).toEqual({ S: 16, M: 22, L: 28 });
  });

  it('QR i text se vejdou do každého formátu', () => {
    for (const f of LABEL_FORMATS) {
      const { w, h } = labelPixelSize(f);
      const g = labelGeometry(w, h);
      expect(g.qrMax + 2 * g.pad + g.caption).toBeLessThanOrEqual(h + 1);
      expect(w - (g.pad + g.qrMax + g.gap) - g.pad).toBeGreaterThan(0); // místo na text
    }
  });

  it('hodnoty buněk z položky a vlastní text', () => {
    const data = { qrValue: 'x', itemName: 'Vrtačka', assetCode: 'INV-1', category: 'Nářadí' };
    expect(
      labelCellValue({ id: 'a', kind: 'name', size: 'L', bold: true, maxLines: 2 }, data),
    ).toBe('Vrtačka');
    expect(
      labelCellValue({ id: 'b', kind: 'location', size: 'S', bold: false, maxLines: 1 }, data),
    ).toBe('');
    expect(
      labelCellValue(
        { id: 'c', kind: 'custom', text: 'Majetek XY', size: 'S', bold: false, maxLines: 1 },
        data,
      ),
    ).toBe('Majetek XY');
  });
});

describe('velikost QR na štítku', () => {
  const url = 'https://app.tagery.tech/r/Oma4iL8CdF6P';

  it('Niimbot 50 × 30 s logem: modul 5 px a QR 195 px (dřív 4 px / 164 px)', () => {
    const g = labelGeometry(384, 240);
    const now = measureBrandedQr(url, g.qrMax, true, QR_MARGIN_MODULES);
    expect(now).toEqual({ size: 195, modulePx: 5, margin: 1 });
    expect(measureBrandedQr(url, 188, true, 2).size).toBe(164);
  });

  it('QR s popiskem nepřesáhne výšku a nechá místo na text v každém formátu', () => {
    for (const f of LABEL_FORMATS) {
      const { w, h } = labelPixelSize(f);
      const g = labelGeometry(w, h);
      const qr = measureBrandedQr(url, g.qrMax, false, QR_MARGIN_MODULES);
      expect(qr.size + 2 + g.caption + 2 * g.pad).toBeLessThanOrEqual(h + 1);
      expect(w - (g.pad + qr.size + g.gap) - g.pad).toBeGreaterThanOrEqual(w * 0.3);
    }
  });
});

describe('sheetSlot', () => {
  it('řádek po řádku, další arch po zaplnění', () => {
    expect(sheetSlot('a4-3x8', 0)).toEqual({ page: 0, leftMm: 0, topMm: 0.5 });
    expect(sheetSlot('a4-3x8', 4)).toEqual({ page: 0, leftMm: 70, topMm: 37.5 });
    expect(sheetSlot('a4-3x8', 24)).toMatchObject({ page: 1, leftMm: 0, topMm: 0.5 });
  });

  it('odmítne formát, který není arch', () => {
    expect(() => sheetSlot('niimbot-50x30', 0)).toThrow();
  });
});
