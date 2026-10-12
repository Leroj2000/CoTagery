import { locationTypeName, mergeLocationTypes, type LocationTypeOverride } from '@tagery/shared';

const row = (o: Partial<LocationTypeOverride> & { key: string }): LocationTypeOverride => ({
  name: null,
  category: null,
  grid: null,
  hidden: false,
  sortOrder: null,
  ...o,
});

describe('typy míst', () => {
  it('bez přepsání = systémový katalog', () => {
    const t = mergeLocationTypes([]);
    expect(t.find((x) => x.key === 'rack')).toMatchObject({
      name: 'Regál',
      grid: true,
      system: true,
    });
    expect(t.every((x) => !x.hidden)).toBe(true);
  });

  it('přejmenování a skrytí systémového typu, kategorie a mřížka zůstávají', () => {
    const t = mergeLocationTypes([
      row({ key: 'warehouse', name: 'Hala', grid: true, category: 'storage' }),
      row({ key: 'city', hidden: true }),
    ]);
    expect(t.find((x) => x.key === 'warehouse')).toMatchObject({
      name: 'Hala',
      category: 'place',
      grid: false,
    });
    expect(t.find((x) => x.key === 'city')?.hidden).toBe(true);
  });

  it('vlastní typy firmy, interní typy se ignorují', () => {
    const t = mergeLocationTypes([
      row({
        key: 'c_kontejner_ab12',
        name: 'Kontejner',
        category: 'storage',
        grid: true,
        sortOrder: 5,
      }),
      row({ key: 'cell', name: 'Hack' }),
    ]);
    expect(t[0]).toMatchObject({ key: 'c_kontejner_ab12', system: false, grid: true });
    expect(t.some((x) => x.key === 'cell')).toBe(false);
    expect(locationTypeName(t, 'cell')).toBe('Buňka');
    expect(locationTypeName(t, 'c_kontejner_ab12')).toBe('Kontejner');
    expect(locationTypeName(t, 'neznamy')).toBe('neznamy');
  });
});
