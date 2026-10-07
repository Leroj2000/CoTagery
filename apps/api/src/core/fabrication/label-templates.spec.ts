import { LABEL_FORMATS, defaultLabelTemplate, normalizeLabelCells } from '@tagery/shared';

describe('katalog formátů štítků', () => {
  it('archy se vejdou na A4 (210 × 297 mm)', () => {
    for (const f of LABEL_FORMATS.filter((x) => x.kind === 'sheet')) {
      const s = f.sheet!;
      const w = s.marginLeftMm * 2 + s.cols * f.widthMm + (s.cols - 1) * s.gapXMm;
      const h = s.marginTopMm * 2 + s.rows * f.heightMm + (s.rows - 1) * s.gapYMm;
      expect(w).toBeLessThanOrEqual(210.01);
      expect(h).toBeLessThanOrEqual(297.01);
    }
  });

  it('Niimbot obraz nepřesáhne tiskovou hlavu B1 (384 px)', () => {
    for (const f of LABEL_FORMATS.filter((x) => x.kind === 'niimbot')) {
      expect(f.niimbot!.w_px).toBeLessThanOrEqual(384);
    }
    expect(LABEL_FORMATS.find((f) => f.key === 'niimbot-50x30')!.niimbot).toMatchObject({
      w_px: 384,
      h_px: 240,
    });
  });

  it('výchozí šablona projde validací', () => {
    for (const f of LABEL_FORMATS) {
      expect(normalizeLabelCells(defaultLabelTemplate(f.key).cells).length).toBeGreaterThan(0);
    }
  });
});

describe('normalizeLabelCells', () => {
  it('doplní výchozí hodnoty a zahodí neznámé vlastnosti', () => {
    const [cell] = normalizeLabelCells([{ id: 'x', kind: 'name', evil: '<script>' }]);
    expect(cell).toEqual({ id: 'x', kind: 'name', size: 'M', bold: false, maxLines: 1 });
  });

  it('vlastní text: povinný, oříznutý, s limitem délky', () => {
    expect(normalizeLabelCells([{ kind: 'custom', text: '  Majetek firmy  ' }])[0].text).toBe(
      'Majetek firmy',
    );
    expect(() => normalizeLabelCells([{ kind: 'custom', text: ' ' }])).toThrow();
    expect(() => normalizeLabelCells([{ kind: 'custom', text: 'x'.repeat(121) }])).toThrow();
  });

  it('odmítne duplicitní předvyplněnou buňku, neznámý typ a příliš mnoho buněk', () => {
    expect(() => normalizeLabelCells([{ kind: 'code' }, { kind: 'code' }])).toThrow();
    expect(() => normalizeLabelCells([{ kind: 'price' }])).toThrow();
    expect(() =>
      normalizeLabelCells(Array.from({ length: 9 }, () => ({ kind: 'custom', text: 'a' }))),
    ).toThrow();
  });

  it('vlastních textů může být víc a dostanou unikátní id', () => {
    const cells = normalizeLabelCells([
      { id: 'a', kind: 'custom', text: '1' },
      { id: 'a', kind: 'custom', text: '2' },
    ]);
    expect(new Set(cells.map((c) => c.id)).size).toBe(2);
  });
});
