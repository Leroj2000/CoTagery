import { LABEL_FORMATS, findLabelFormat } from '@tagery/shared';
import { labelCellValue, labelGeometry, labelPixelSize } from '../render-label';
import { sheetSlot } from '../print-sheet';

describe('rozložení štítku', () => {
  it('Niimbot 50 × 30 zachová dosavadní rozměry (384 × 240, QR 188)', () => {
    const { w, h } = labelPixelSize(findLabelFormat('niimbot-50x30')!);
    expect([w, h]).toEqual([384, 240]);
    const g = labelGeometry(w, h);
    expect(g.qrMax).toBe(188);
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
