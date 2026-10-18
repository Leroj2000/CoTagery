import { PHOTO_GRID_CLASS, photoImageClass, photoTileClass } from './photo-layout';

describe('rozložení galerie fotek', () => {
  it('desktop: mřížka 4 sloupce, hlavní fotka zabírá polovinu (2 sloupce × 2 řádky)', () => {
    expect(PHOTO_GRID_CLASS).toContain('lg:grid-cols-4');
    expect(photoTileClass(0)).toContain('lg:col-span-2');
    expect(photoTileClass(0)).toContain('lg:row-span-2');
  });

  it('mobil: hlavní fotka přes celou šířku, náhledy pod ní', () => {
    expect(PHOTO_GRID_CLASS).toMatch(/(^| )grid-cols-3( |$)/);
    expect(photoTileClass(0)).toContain('col-span-full');
  });

  it('náhledy jsou čtvercové jednotlivé buňky vedle hlavní fotky', () => {
    expect(photoTileClass(1)).not.toMatch(/col-span|row-span/);
    expect(photoImageClass(1)).toContain('aspect-square');
    expect(photoImageClass(0)).toContain('aspect-[4/3]');
  });
});
