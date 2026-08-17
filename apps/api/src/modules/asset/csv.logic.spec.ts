import { toCsv, parseCsv, csvToObjects } from './csv.logic';

describe('csv.logic', () => {
  it('toCsv: escapuje čárky, uvozovky, nové řádky', () => {
    const csv = toCsv([
      ['name', 'note'],
      ['Vrtačka', 'ok'],
      ['Bruska, velká', 'má "štítek"'],
      ['Víceřádek', 'a\nb'],
    ]);
    expect(csv.split('\n')[0]).toBe('name,note');
    expect(csv).toContain('"Bruska, velká"');
    expect(csv).toContain('"má ""štítek"""');
    expect(csv).toContain('"a\nb"');
  });

  it('parseCsv: rozparsuje uvozovaná pole s čárkou i zdvojenou uvozovkou', () => {
    const rows = parseCsv('name,note\n"Bruska, velká","má ""štítek"""\nVrtačka,ok');
    expect(rows).toEqual([
      ['name', 'note'],
      ['Bruska, velká', 'má "štítek"'],
      ['Vrtačka', 'ok'],
    ]);
  });

  it('parseCsv: přeskočí prázdné řádky', () => {
    expect(parseCsv('a,b\n\n\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('csvToObjects: mapuje podle hlavičky (case-insensitive)', () => {
    const objs = csvToObjects('Name,Category\nVrtačka,Nářadí\nLaser,Měřicí');
    expect(objs).toEqual([
      { name: 'Vrtačka', category: 'Nářadí' },
      { name: 'Laser', category: 'Měřicí' },
    ]);
  });

  it('csvToObjects: prázdný/jen hlavička → []', () => {
    expect(csvToObjects('name,category')).toEqual([]);
    expect(csvToObjects('')).toEqual([]);
  });

  it('round-trip: toCsv → parseCsv', () => {
    const data = [
      ['name', 'note'],
      ['A, B', 'x"y'],
    ];
    expect(parseCsv(toCsv(data))).toEqual(data);
  });
});
