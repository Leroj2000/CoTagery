import {
  LIST_THUMB_CELL_CLASS,
  LIST_THUMB_CLASS,
  LIST_THUMB_PLACEHOLDER_CLASS,
  LIST_THUMB_PX,
} from './list-thumb';

describe('náhled v seznamu položek', () => {
  const all = [LIST_THUMB_CELL_CLASS, LIST_THUMB_CLASS, LIST_THUMB_PLACEHOLDER_CLASS];

  it('není skrytý na žádném breakpointu', () => {
    for (const cls of all) expect(cls).not.toMatch(/(^|\s)([a-z0-9]+:)?hidden(\s|$)/);
  });

  it('nezmáčkne se v široké tabulce (pevná min. šířka, shrink-0)', () => {
    expect(LIST_THUMB_CELL_CLASS).toContain('min-w-12');
    for (const cls of [LIST_THUMB_CLASS, LIST_THUMB_PLACEHOLDER_CLASS]) {
      expect(cls).toContain('shrink-0');
      expect(cls).toContain('min-w-10');
    }
  });

  it('malý náhled 40 px', () => {
    expect(LIST_THUMB_PX).toBeGreaterThanOrEqual(40);
    expect(LIST_THUMB_PX).toBeLessThanOrEqual(48);
  });
});
