import { buildLabelSvg } from './label';

describe('buildLabelSvg', () => {
  const qr = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25 25"><path d="M0 0h1v1H0z"/></svg>';

  it('vloží QR jako vnořený svg a přidá kód jako text', () => {
    const out = buildLabelSvg(qr, 'ABC123');
    expect(out.startsWith('<svg')).toBe(true);
    expect(out).toContain('ABC123');
    expect(out).toContain('x="30" y="24" width="240" height="240"');
    expect(out).toContain('viewBox="0 0 25 25"'); // zachovaný viewBox QR
  });
});
