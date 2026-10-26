import { V1ActionsProvider } from './v1.actions';
import type { ActionExecutionContext } from './channel-action';

const SLOT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const BOOKING = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ASSET = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

describe('MCP akce tireslot.*', () => {
  function setup() {
    const slotView = {
      id: SLOT,
      startsAt: '2026-11-10T08:00:00.000Z',
      endsAt: '2026-11-10T09:00:00.000Z',
      location: 'Pneuservis',
      note: null,
      capacity: 1,
      season: 'winter' as const,
      booked: 0,
      bookable: true,
      bookings: [],
    };
    const bookingView = {
      id: BOOKING,
      slotId: SLOT,
      assetId: ASSET,
      assetName: 'Škoda Octavia',
      plate: '1AB 2345',
      personId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      personName: 'Jan Novák',
      status: 'booked' as const,
      startsAt: slotView.startsAt,
      endsAt: slotView.endsAt,
      location: 'Pneuservis',
      season: 'winter' as const,
      changeable: true,
    };
    const vehicleView = {
      assetId: ASSET,
      assetName: 'Škoda Octavia',
      plate: '1AB 2345',
      booking: bookingView,
      canBook: false,
      reason: 'Vozidlo už má termín přezutí.',
      suggestions: [slotView],
    };
    const tireSlots = {
      list: jest.fn().mockResolvedValue([slotView]),
      mine: jest.fn().mockResolvedValue({ linked: true, vehicles: [vehicleView] }),
      book: jest.fn().mockResolvedValue(bookingView),
      cancel: jest.fn().mockResolvedValue({ cancelled: true }),
      move: jest.fn().mockResolvedValue({ ...bookingView, slotId: SLOT }),
    };
    const assets = {
      get: jest.fn().mockResolvedValue({
        id: ASSET,
        name: 'Škoda Octavia',
        status: 'available',
        homeLocationId: null,
      }),
      scanLookup: jest.fn(),
    };
    const context = { tenantId: 'tenant', manager: { query: jest.fn().mockResolvedValue([]) } };
    const provider = new V1ActionsProvider(
      undefined as never,
      context as never,
      assets as never,
      undefined as never,
      tireSlots as never,
    );
    const ctx = {
      userId: 'user-1',
      tenantId: 'tenant',
      webUrl: (p: string) => `https://app.tagery.tech${p}`,
    } as ActionExecutionContext;
    const action = (key: string) => provider.actions().find((a) => a.key === key)!;
    return { action, tireSlots, assets, ctx };
  }

  it('registruje 5 akcí s asset.tireslot.book; zápisy vyžadují potvrzení', () => {
    const { action } = setup();
    expect(action('tireslot.list')).toMatchObject({
      permission: 'asset.tireslot.book',
      kind: 'read',
      requiresConfirmation: false,
      scope: 'tenant',
    });
    expect(action('tireslot.mine')).toMatchObject({ kind: 'read', permission: 'asset.tireslot.book' });
    for (const key of ['tireslot.book', 'tireslot.cancel', 'tireslot.move'] as const) {
      expect(action(key)).toMatchObject({
        kind: 'write',
        requiresConfirmation: true,
        permission: 'asset.tireslot.book',
        scope: 'tenant',
      });
    }
  });

  it('tireslot.list vrátí volné termíny a volá službu s obdobím', async () => {
    const { action, tireSlots, ctx } = setup();
    const out = (await action('tireslot.list').execute(ctx, {
      from: '2026-11-01T00:00:00.000Z',
      to: '2026-11-30T00:00:00.000Z',
    } as never)) as { freeCount: number; free: { id: string }[] };
    expect(tireSlots.list).toHaveBeenCalledWith(
      { userId: 'user-1', tenantId: 'tenant', tenantRole: '' },
      '2026-11-01T00:00:00.000Z',
      '2026-11-30T00:00:00.000Z',
    );
    expect(out.freeCount).toBe(1);
    expect(out.free[0].id).toBe(SLOT);
  });

  it('tireslot.mine vrátí vozidla a rezervace', async () => {
    const { action, tireSlots, ctx } = setup();
    const out = (await action('tireslot.mine').execute(ctx, {} as never)) as {
      linked: boolean;
      vehicles: { plate: string; booking: { id: string } }[];
    };
    expect(tireSlots.mine).toHaveBeenCalled();
    expect(out.linked).toBe(true);
    expect(out.vehicles[0].plate).toBe('1AB 2345');
    expect(out.vehicles[0].booking?.id).toBe(BOOKING);
  });

  it('tireslot.book resolvuje vozidlo a volá book', async () => {
    const { action, tireSlots, assets, ctx } = setup();
    const out = (await action('tireslot.book').execute(ctx, {
      slotId: SLOT,
      asset: ASSET,
    } as never)) as { id: string; url: string };
    expect(assets.get).toHaveBeenCalledWith(ASSET);
    expect(tireSlots.book).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' }),
      SLOT,
      ASSET,
    );
    expect(out.id).toBe(BOOKING);
    expect(out.url).toContain(ASSET);
  });

  it('tireslot.cancel a tireslot.move delegují na službu', async () => {
    const { action, tireSlots, ctx } = setup();
    await action('tireslot.cancel').execute(ctx, { bookingId: BOOKING } as never);
    expect(tireSlots.cancel).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }), BOOKING);
    await action('tireslot.move').execute(ctx, { bookingId: BOOKING, slotId: SLOT } as never);
    expect(tireSlots.move).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' }),
      BOOKING,
      SLOT,
    );
  });
});
