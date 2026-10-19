import { ASSET_NOT_FOUND, PAGE_NOT_FOUND } from './not-found-copy';

describe('stránky nenalezeno', () => {
  it('detail položky vysvětlí jinou firmu / jiný účet (Bluefy) a nabídne cestu zpět', () => {
    const text = [ASSET_NOT_FOUND.lead, ...ASSET_NOT_FOUND.hints].join(' ');
    expect(text).toMatch(/firm/);
    expect(text).toMatch(/Bluefy/);
    expect(ASSET_NOT_FOUND.back.href).toBe('/admin/assets');
  });

  it('obecná 404 je česky a vede na úvod', () => {
    expect(PAGE_NOT_FOUND.title).toBe('Stránka nenalezena');
    expect(PAGE_NOT_FOUND.back.href).toBe('/admin');
  });
});
