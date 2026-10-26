import { buildCustody, formatDueDate } from './custody';
import { V1ActionsProvider } from './v1.actions';
import type { ActionExecutionContext } from './channel-action';

const JAN = '22222222-2222-4222-8222-222222222222';
const HOME = '33333333-3333-4333-8333-333333333333';
const LEICA = '44444444-4444-4444-8444-444444444444';
const names = {
  person: new Map([[JAN, 'Jan Novák']]),
  location: new Map([[HOME, 'Zvěřinových']]),
  asset: new Map<string, string>(),
};
const NOW = new Date('2026-10-19T12:00:00Z');

describe('buildCustody', () => {
  it('výpůjčka osobě: jméno, od kdy, vrátit do, patří do', () => {
    const c = buildCustody(
      {
        currentHolderType: 'person',
        currentHolderId: JAN,
        homeLocationId: HOME,
        dueAt: new Date('2026-10-23T15:00:00Z'),
      },
      { type: 'loan', createdAt: new Date('2026-10-16T08:00:00Z') },
      names,
      NOW,
    );
    expect(c).toEqual({
      holder: { type: 'person', name: 'Jan Novák' },
      custodyType: 'loan',
      since: '2026-10-16T08:00:00.000Z',
      dueAt: '2026-10-23T15:00:00.000Z',
      dueDate: '23. 10. 2026',
      overdue: false,
      belongsTo: 'Zvěřinových',
    });
  });

  it('po termínu → overdue; přidělení → assignment', () => {
    const c = buildCustody(
      {
        currentHolderType: 'person',
        currentHolderId: JAN,
        homeLocationId: HOME,
        dueAt: new Date('2026-10-17T10:00:00Z'),
      },
      { type: 'assign', createdAt: new Date('2026-10-01T08:00:00Z') },
      names,
      NOW,
    );
    expect(c).toMatchObject({ custodyType: 'assignment', overdue: true, dueDate: '17. 10. 2026' });
  });

  it('doma na svém místě: bez typu držení a bez overdue', () => {
    const c = buildCustody(
      { currentHolderType: 'location', currentHolderId: HOME, homeLocationId: HOME, dueAt: null },
      { type: 'return', createdAt: new Date('2026-10-02T08:00:00Z') },
      names,
      NOW,
    );
    expect(c).toMatchObject({
      holder: { type: 'location', name: 'Zvěřinových' },
      custodyType: null,
      since: null,
      overdue: false,
    });
  });

  it('datum v pražském čase', () => {
    expect(formatDueDate(new Date('2026-10-22T22:30:00Z'))).toBe('23. 10. 2026');
  });
});

describe('MCP akce s držitelem', () => {
  const leica = {
    id: LEICA,
    name: 'Leica NA720',
    status: 'loaned',
    category: null,
    inventoryNumber: 'APR-M-001',
    registrationPlate: null,
    homeLocationId: HOME,
    currentHolderType: 'person',
    currentHolderId: JAN,
    dueAt: new Date('2026-10-23T15:00:00Z'),
    manufacturer: 'Leica',
    model: 'NA720',
    serialNumber: null,
  };
  function setup() {
    const query = jest.fn(async (sql: string, _params?: unknown[]) => {
      if (sql.includes('FROM locations')) return [{ id: HOME, name: 'Zvěřinových' }];
      if (sql.includes('FROM people') && sql.includes('ILIKE'))
        return [{ id: JAN, name: 'Jan Novák' }];
      if (sql.includes('FROM people')) return [{ id: JAN, name: 'Jan Novák' }];
      if (sql.includes('asset_movements'))
        return [{ asset_id: LEICA, type: 'loan', created_at: '2026-10-16T08:00:00Z' }];
      return [];
    });
    const find = jest.fn().mockResolvedValue([leica]);
    const context = { tenantId: 'tenant', manager: { query, getRepository: () => ({ find }) } };
    const assets = {
      get: jest.fn().mockResolvedValue(leica),
      listIssues: jest.fn().mockResolvedValue([]),
      search: jest.fn().mockResolvedValue({ items: [leica], total: 1 }),
    };
    const provider = new V1ActionsProvider(
      undefined as never,
      context as never,
      assets as never,
      undefined as never,
      undefined as never,
    );
    const ctx = { webUrl: (p: string) => `https://app.tagery.tech${p}` } as ActionExecutionContext;
    const action = (key: string) => provider.actions().find((a) => a.key === key)!;
    return { action, ctx, query, find };
  }

  it('asset.get APR-M-001 ukazuje Jana Nováka a termín 23. 10. 2026', async () => {
    const { action, ctx } = setup();
    const out = await action('asset.get').execute(ctx, { assetId: LEICA } as never);
    expect(out).toMatchObject({
      holder: { type: 'person', name: 'Jan Novák' },
      custodyType: 'loan',
      dueDate: '23. 10. 2026',
      overdue: false,
      belongsTo: 'Zvěřinových',
    });
  });

  it('asset.search vrací držitele u každé položky', async () => {
    const { action, ctx } = setup();
    const out = (await action('asset.search').execute(ctx, { query: 'Leica' } as never)) as {
      items: { holder: { name: string } }[];
    };
    expect(out.items[0].holder.name).toBe('Jan Novák');
  });

  it('asset.held_by: co má Jan Novák (jen v tenantu, jen čtení)', async () => {
    const { action, ctx, query } = setup();
    const a = action('asset.held_by');
    expect(a).toMatchObject({ permission: 'asset.item.view', kind: 'read', scope: 'tenant' });
    const out = (await a.execute(ctx, { person: 'Novák' } as never)) as {
      people: string[];
      total: number;
      items: { inventoryNumber: string }[];
    };
    expect(out).toMatchObject({ people: ['Jan Novák'], total: 1 });
    expect(out.items[0].inventoryNumber).toBe('APR-M-001');
    const [, params] = query.mock.calls.find(([sql]) => String(sql).includes('ILIKE'))!;
    expect(params).toEqual(['tenant', 'Novák']);
  });
});
