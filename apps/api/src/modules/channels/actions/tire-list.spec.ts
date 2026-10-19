import { NotFoundException } from '@nestjs/common';
import type { AssetTire } from '../../asset/entities/asset-tire.entity';
import { buildTireSets } from './tire-list';
import { V1ActionsProvider } from './v1.actions';
import type { ActionExecutionContext } from './channel-action';

const ASSET_ID = '6115f03a-3fed-40b8-86c6-b830295c7df2';
const STORE = '11111111-1111-4111-8111-111111111111';

const tire = (p: Partial<AssetTire>): AssetTire =>
  ({
    id: 'x',
    assetId: ASSET_ID,
    setLabel: 'Letní',
    season: 'summer',
    axle: 'all',
    width: 225,
    aspectRatio: 45,
    rimDiameter: 17,
    construction: 'R',
    loadIndex: '94',
    speedIndex: 'W',
    brand: 'Michelin',
    dot: '1424',
    treadDepthMm: 6.8,
    quantity: 4,
    mounted: false,
    storedLocationId: STORE,
    note: null,
    ...p,
  }) as AssetTire;

const OCTAVIA = [
  tire({}),
  tire({
    setLabel: 'Zimní',
    season: 'winter',
    width: 205,
    aspectRatio: 55,
    rimDiameter: 16,
    loadIndex: '91',
    speedIndex: 'H',
    mounted: true,
    storedLocationId: STORE,
  }),
];

describe('buildTireSets', () => {
  it('namontovaná sada první, rozměr formátovaný, sklad jen u nenamontované', () => {
    const sets = buildTireSets(OCTAVIA, new Map([[STORE, 'Pneuservis']]));
    expect(sets.map((s) => [s.setLabel, s.mounted, s.storedLocation])).toEqual([
      ['Zimní', true, null],
      ['Letní', false, 'Pneuservis'],
    ]);
    expect(sets[0].rows[0]).toMatchObject({ size: '205/55 R16 91H', axleLabel: 'Všechna kola' });
    expect(sets[1]).toMatchObject({ season: 'summer', seasonLabel: 'Letní' });
    expect(sets[1].rows[0]).toMatchObject({ dot: '1424', treadDepthMm: 6.8, quantity: 4 });
  });

  it('nápravy přední → zadní; výstup bez interních id', () => {
    const [set] = buildTireSets(
      [tire({ axle: 'rear', mounted: true }), tire({ axle: 'front', mounted: true })],
      new Map(),
    );
    expect(set.rows.map((r) => r.axle)).toEqual(['front', 'rear']);
    expect(JSON.stringify(set)).not.toContain(ASSET_ID);
  });
});

describe('akce tire.list', () => {
  function setup(sqlRows: { id: string }[] = [], scanAssetId: string | null = null) {
    const asset = {
      id: ASSET_ID,
      name: 'Škoda Octavia',
      status: 'available',
      homeLocationId: null,
    };
    const assets = {
      get: jest.fn().mockResolvedValue(asset),
      scanLookup: jest.fn().mockResolvedValue({
        found: !!scanAssetId,
        asset: scanAssetId ? { id: scanAssetId } : null,
      }),
    };
    const query = jest.fn(async (sql: string, _params?: unknown[]) =>
      sql.includes('FROM locations') ? [{ id: STORE, name: 'Pneuservis' }] : sqlRows,
    );
    const context = { tenantId: 'tenant', manager: { query } };
    const tires = { list: jest.fn().mockResolvedValue(OCTAVIA) };
    const provider = new V1ActionsProvider(
      undefined as never,
      context as never,
      assets as never,
      tires as never,
    );
    const action = provider.actions().find((a) => a.key === 'tire.list')!;
    const ctx = { webUrl: (p: string) => `https://app.tagery.tech${p}` } as ActionExecutionContext;
    return { action, assets, tires, ctx, query };
  }

  it('je jen ke čtení s oprávněním asset.item.view v kontextu firmy', () => {
    const { action } = setup();
    expect(action).toMatchObject({
      permission: 'asset.item.view',
      kind: 'read',
      requiresConfirmation: false,
      scope: 'tenant',
    });
  });

  it('podle uuid vrátí obě sady Octavie', async () => {
    const { action, ctx, assets, tires } = setup();
    const out = (await action.execute(ctx, { asset: ASSET_ID } as never)) as {
      mounted: string;
      sets: { setLabel: string }[];
    };
    expect(assets.get).toHaveBeenCalledWith(ASSET_ID);
    expect(tires.list).toHaveBeenCalledWith(ASSET_ID);
    expect(out.mounted).toBe('Zimní');
    expect(out.sets.map((s) => s.setLabel)).toEqual(['Zimní', 'Letní']);
  });

  it('podle inventárního čísla / SPZ (SQL v tenantu)', async () => {
    const { action, ctx, query, assets } = setup([{ id: ASSET_ID }]);
    await action.execute(ctx, { asset: 'APR-V-002' } as never);
    const [, params] = query.mock.calls.find(([sql]) => String(sql).includes('FROM assets'))!;
    expect(params).toEqual(['tenant', 'APR-V-002']);
    expect(assets.scanLookup).not.toHaveBeenCalled();
  });

  it('podle QR kódu bez záznamu skenu; neznámý kód → 404', async () => {
    const qr = setup([], ASSET_ID);
    await qr.action.execute(qr.ctx, { asset: 'Oma4iL8CdF6P' } as never);
    expect(qr.assets.scanLookup).toHaveBeenCalledWith('Oma4iL8CdF6P', undefined, undefined, false);
    const none = setup([], null);
    await expect(none.action.execute(none.ctx, { asset: 'nic' } as never)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
