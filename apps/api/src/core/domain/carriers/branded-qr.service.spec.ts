import { qrLogoBox, qrLogoHole } from '@tagery/shared';
import { buildQrSvg } from './branded-qr.service';

describe('qrLogoHole', () => {
  it.each([21, 25, 29, 33, 37, 41, 57])('je vycentrovaný a v mezích plochy (%i modulů)', (n) => {
    for (const aspect of [0.5, 1, 1.3, 3]) {
      const h = qrLogoHole(n, aspect);
      expect(Number.isInteger(h.x) && Number.isInteger(h.y)).toBe(true);
      expect(h.x * 2 + h.w).toBe(n); // přesně uprostřed
      expect(h.y * 2 + h.h).toBe(n);
      // nezasahuje do hledacích vzorů (7 modulů + 1 oddělovač v rozích)
      expect(h.x).toBeGreaterThanOrEqual(8);
      expect(h.y).toBeGreaterThanOrEqual(8);
      // max. ~11 % plochy (+ zaokrouhlení na minimum 5 modulů u malých matic)
      expect(h.w * h.h).toBeLessThanOrEqual(Math.max(n * n * 0.11, 25) + n);
    }
  });

  it('obdélníkové logo dostane obdélníkový otvor', () => {
    const h = qrLogoHole(33, 2);
    expect(h.w).toBeGreaterThan(h.h);
  });

  it('logo leží uvnitř otvoru s bílým okrajem', () => {
    const hole = qrLogoHole(33, 1.3);
    const box = qrLogoBox(hole, 1.3);
    expect(box.x).toBeGreaterThanOrEqual(hole.x + 1);
    expect(box.y).toBeGreaterThanOrEqual(hole.y + 1);
    expect(box.x + box.w).toBeLessThanOrEqual(hole.x + hole.w - 1 + 1e-9);
    expect(box.y + box.h).toBeLessThanOrEqual(hole.y + hole.h - 1 + 1e-9);
  });
});

describe('buildQrSvg', () => {
  const url = 'https://app.tagery.tech/r/AB12CD34';
  const logo = { buffer: Buffer.from('fake-png'), aspect: 1 };

  it('bez loga: žádný obrázek, korekce M (menší matice)', () => {
    const svg = buildQrSvg(url, null);
    expect(svg).not.toContain('<image');
    expect(svg).toMatch(/viewBox="0 0 (\d+) \1"/);
  });

  it('s logem: vloží PNG a použije korekci H (hustší matice)', () => {
    const plain = Number(/viewBox="0 0 (\d+)/.exec(buildQrSvg(url, null))![1]);
    const svg = buildQrSvg(url, logo);
    const branded = Number(/viewBox="0 0 (\d+)/.exec(svg)![1]);
    expect(svg).toContain('href="data:image/png;base64,');
    expect(branded).toBeGreaterThan(plain);
  });

  it('pro rastrování zaokrouhlí rozměr na celé moduly', () => {
    const svg = buildQrSvg(url, null, 1, 512);
    const size = Number(/viewBox="0 0 (\d+)/.exec(svg)![1]);
    const px = Number(/width="(\d+)"/.exec(svg)![1]);
    expect(px % size).toBe(0);
    expect(px).toBeGreaterThanOrEqual(512);
  });
});
