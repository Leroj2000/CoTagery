import { V1ActionsProvider } from './v1.actions';
import type { ActionExecutionContext } from './channel-action';

const ctx = {
  userId: 'u1',
  tenantId: 't1',
  webUrl: (p: string) => `https://app.tagery.tech${p}`,
} as ActionExecutionContext;

const report = {
  days: 90,
  from: '2026-08-01T00:00:00.000Z',
  to: '2026-10-30T00:00:00.000Z',
  totals: { overused: 1, idle: 1, ok: 1, new: 0 },
  categories: [
    { category: 'Vrtačky', assets: 2, avgUtilizationPct: 50, overused: 1, idle: 1 },
    { category: 'Žebříky', assets: 1, avgUtilizationPct: 40, overused: 0, idle: 0 },
  ],
  assets: [
    {
      assetId: 'a1',
      assetName: 'Vrtačka 1',
      category: 'Vrtačky',
      utilizationPct: 95,
      daysInUse: 85,
      daysTracked: 90,
      daysInService: 0,
      movementsInWindow: 4,
      lastMovementAt: null,
      daysSinceMovement: 3,
      verdict: 'overused',
    },
    {
      assetId: 'a2',
      assetName: 'Vrtačka 2',
      category: 'Vrtačky',
      utilizationPct: 0,
      daysInUse: 0,
      daysTracked: 90,
      daysInService: 0,
      movementsInWindow: 0,
      lastMovementAt: null,
      daysSinceMovement: 120,
      verdict: 'idle',
    },
    {
      assetId: 'a3',
      assetName: 'Žebřík',
      category: 'Žebříky',
      utilizationPct: 40,
      daysInUse: 36,
      daysTracked: 90,
      daysInService: 0,
      movementsInWindow: 2,
      lastMovementAt: null,
      daysSinceMovement: 10,
      verdict: 'ok',
    },
  ],
};

const attention = {
  overdue: [],
  pendingConfirmations: [],
  openIssues: [],
  dueServices: [],
};

const paid = [
  {
    serviceId: 's1',
    assetId: 'a1',
    assetName: 'Vrtačka 1',
    performedOn: '2026-10-01',
    provider: 'Servis XY',
    note: null,
    warrantyTitle: 'Záruka výrobce',
    warrantyEndsOn: '2027-05-01',
    warrantyProvider: 'Hilti',
  },
];

function provider(moduleActive: boolean) {
  const utilization = { report: jest.fn().mockResolvedValue(report) };
  const purchases = { paidRepairsUnderWarranty: jest.fn().mockResolvedValue(paid) };
  const authz = { isModuleActive: jest.fn().mockResolvedValue(moduleActive) };
  const assets = { attention: jest.fn().mockResolvedValue(attention) };
  const p = new V1ActionsProvider(
    undefined as never,
    { manager: { query: jest.fn().mockResolvedValue([]) }, tenantId: 't1' } as never,
    assets as never,
    undefined as never,
    undefined as never,
    purchases as never,
    utilization as never,
    authz as never,
  );
  const action = (key: string) => p.actions().find((a) => a.key === key)!;
  return { action, utilization, purchases, authz };
}

describe('MCP report.utilization', () => {
  it('je read-only s asset.item.view a výchozími 90 dny', async () => {
    const { action, utilization } = provider(true);
    const a = action('report.utilization');
    expect(a.kind).toBe('read');
    expect(a.permission).toBe('asset.item.view');
    const input = a.input.parse({});
    expect(input).toEqual({ days: 90 });
    const out = (await a.execute(ctx, input)) as { assetsCount: number; reportUrl: string };
    expect(utilization.report).toHaveBeenCalledWith(90);
    expect(out.assetsCount).toBe(3);
    expect(out.reportUrl).toBe('https://app.tagery.tech/admin/vytizenost?days=90');
  });

  it('validuje rozsah dní', () => {
    const { action } = provider(true);
    expect(() => action('report.utilization').input.parse({ days: 3 })).toThrow();
    expect(() => action('report.utilization').input.parse({ days: 400 })).toThrow();
  });

  it('filtruje podle verdiktu a kategorie', async () => {
    const { action } = provider(true);
    const a = action('report.utilization');
    const idle = (await a.execute(ctx, a.input.parse({ verdict: 'idle' }))) as {
      assets: { asset: string }[];
    };
    expect(idle.assets.map((x) => x.asset)).toEqual(['Vrtačka 2']);
    const cat = (await a.execute(ctx, a.input.parse({ category: 'žebř' }))) as {
      assets: { asset: string }[];
      categories: { category: string }[];
    };
    expect(cat.assets.map((x) => x.asset)).toEqual(['Žebřík']);
    expect(cat.categories.map((c) => c.category)).toEqual(['Žebříky']);
  });
});

describe('MCP attention.list – placené opravy v záruce', () => {
  it('přidá sekci, když je modul purchase zapnutý', async () => {
    const { action } = provider(true);
    const out = (await action('attention.list').execute(ctx, {})) as {
      paidRepairsUnderWarrantyCount: number;
      paidRepairsUnderWarranty: { asset: string; protocolUrl: string }[];
    };
    expect(out.paidRepairsUnderWarrantyCount).toBe(1);
    expect(out.paidRepairsUnderWarranty[0]).toMatchObject({
      asset: 'Vrtačka 1',
      claimWith: 'Hilti',
      protocolUrl: 'https://app.tagery.tech/admin/assets/a1/reklamace/s1',
    });
  });

  it('bez modulu purchase sekci vynechá', async () => {
    const { action, purchases } = provider(false);
    const out = (await action('attention.list').execute(ctx, {})) as Record<string, unknown>;
    expect(out).not.toHaveProperty('paidRepairsUnderWarranty');
    expect(purchases.paidRepairsUnderWarranty).not.toHaveBeenCalled();
  });
});
