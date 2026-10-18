import type { AssetTireView } from '@tagery/shared';
import { groupTireSets, mountedTireSummary, showsTires } from './tires';

const t = (p: Partial<AssetTireView>): AssetTireView => ({
  id: Math.random().toString(36),
  assetId: 'a',
  setLabel: 'Letní',
  season: 'summer',
  axle: 'all',
  width: 205,
  aspectRatio: 55,
  rimDiameter: 16,
  construction: 'R',
  loadIndex: '91',
  speedIndex: 'V',
  brand: null,
  dot: null,
  treadDepthMm: null,
  quantity: 4,
  mounted: false,
  storedLocationId: null,
  note: null,
  ...p,
});

describe('pneumatiky – web', () => {
  it('seskupí sady, namontovaná první, nápravy přední → zadní', () => {
    const sets = groupTireSets([
      t({ setLabel: 'Letní' }),
      t({ setLabel: 'Zimní', season: 'winter', axle: 'rear', width: 225, mounted: true }),
      t({ setLabel: 'Zimní', season: 'winter', axle: 'front', mounted: true }),
    ]);
    expect(sets.map((s) => `${s.label}:${s.mounted}`)).toEqual(['Zimní:true', 'Letní:false']);
    expect(sets[0].rows.map((r) => r.axle)).toEqual(['front', 'rear']);
  });

  it('souhrn namontované sady do hlavičky', () => {
    expect(mountedTireSummary([t({ mounted: true })])).toBe('205/55 R16 91V');
    expect(
      mountedTireSummary([
        t({ mounted: true, axle: 'front' }),
        t({ mounted: true, axle: 'rear', width: 225, aspectRatio: 45, rimDiameter: 17 }),
      ]),
    ).toBe('205/55 R16 91V / 225/45 R17 91V');
    expect(mountedTireSummary([t({})])).toBeNull();
  });

  it('sekce jen pro vozidla a stroje', () => {
    expect(showsTires('vehicle')).toBe(true);
    expect(showsTires('machine')).toBe(true);
    expect(showsTires('general')).toBe(false);
  });
});
