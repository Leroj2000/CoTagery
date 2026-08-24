import { COPIES_MAX, COPIES_MIN, LABEL_50X30, NIIMBOT_B1_MODEL } from '../niimbot-config';
import { isSupportedB1 } from '../model-check';

describe('centrální konfigurace B1 / štítku', () => {
  it('tisková bitmapa je přesně 384 × 240 px', () => {
    expect(LABEL_50X30.w_px).toBe(384);
    expect(LABEL_50X30.h_px).toBe(240);
  });

  it('fyzický rozměr 50 × 30 mm, 203 DPI', () => {
    expect(LABEL_50X30.widthMm).toBe(50);
    expect(LABEL_50X30.heightMm).toBe(30);
    expect(LABEL_50X30.dpi).toBe(203);
  });

  it('výchozí parametry B1 dle zadání', () => {
    expect(NIIMBOT_B1_MODEL.task).toBe('b1');
    expect(NIIMBOT_B1_MODEL.density).toBe(3);
    expect(NIIMBOT_B1_MODEL.speed).toBe(1);
    expect(NIIMBOT_B1_MODEL.label_type).toBe(1);
    expect(NIIMBOT_B1_MODEL.name_prefixes).toContain('B1');
  });

  it('meze kopií jsou 1 a 99', () => {
    expect(COPIES_MIN).toBe(1);
    expect(COPIES_MAX).toBe(99);
  });
});

describe('odmítnutí B1 Pro / jiné tiskárny při konfiguraci pro B1', () => {
  it('přijme B1 (task b1, 203 DPI)', () => {
    expect(isSupportedB1({ task: 'b1', dpi: 203, label: 'Niimbot B1' })).toBe(true);
  });

  it('odmítne B1 Pro (task v4, 300 DPI)', () => {
    expect(isSupportedB1({ task: 'v4', dpi: 300, label: 'Niimbot B1 Pro' })).toBe(false);
  });

  it('odmítne jiný task nebo jiné DPI', () => {
    expect(isSupportedB1({ task: 'v4', dpi: 203 })).toBe(false);
    expect(isSupportedB1({ task: 'b1', dpi: 300 })).toBe(false);
  });

  it('neúplná identifikace (null pole) tiskárnu neblokuje', () => {
    expect(isSupportedB1({ task: null, dpi: null })).toBe(true);
  });
});
