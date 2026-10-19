import 'reflect-metadata';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  bookingDenial,
  bookingPerson,
  cancelDenial,
  generateSlotTimes,
  pickSeasonSet,
  slotDenial,
  withinCutoff,
} from './tire-slots.logic';
import { TireSlotsService } from './tire-slots.service';
import { CreateTireSlotsDto } from './tire-slots.controller';

const H = 3_600_000;
const NOW = new Date('2026-10-20T08:00:00Z');
const at = (hours: number) => new Date(NOW.getTime() + hours * H);

const base = {
  isManager: false,
  personId: 'p1',
  holderType: 'person',
  holderId: 'p1',
  responsiblePersonId: null,
  equipmentKind: 'vehicle',
};

describe('bookingDenial (kdo smí rezervovat)', () => {
  it('držitel vozidla smí', () => expect(bookingDenial(base)).toBeNull());
  it('odpovědná osoba smí, i když vozidlo drží někdo jiný', () =>
    expect(bookingDenial({ ...base, holderId: 'p2', responsiblePersonId: 'p1' })).toBeNull());
  it('cizí osoba nesmí', () =>
    expect(bookingDenial({ ...base, holderId: 'p2' })).toMatch(/držitel vozidla nebo odpovědná/));
  it('vozidlo na místě bez odpovědné osoby rezervuje jen správce', () => {
    const loc = { ...base, holderType: 'location', holderId: 'l1' };
    expect(bookingDenial(loc)).toMatch(/správce/);
    expect(bookingDenial({ ...loc, isManager: true })).toBeNull();
  });
  it('nevozidlo nejde ani správci', () => {
    expect(bookingDenial({ ...base, equipmentKind: 'machine', isManager: true })).toMatch(
      /vozidla/,
    );
    expect(bookingDenial({ ...base, equipmentKind: null })).toMatch(/vozidla/);
  });
  it('účet bez osoby nesmí (kromě správce)', () => {
    expect(bookingDenial({ ...base, personId: null })).toMatch(/spojený s osobou/);
    expect(bookingDenial({ ...base, personId: null, isManager: true })).toBeNull();
  });
  it('rezervace se eviduje na držitele, jinak odpovědnou osobu, jinak uživatele', () => {
    expect(bookingPerson({ ...base, personId: 'mgr', holderId: 'p2' })).toBe('p2');
    expect(
      bookingPerson({
        ...base,
        personId: 'mgr',
        holderType: 'location',
        responsiblePersonId: 'p3',
      }),
    ).toBe('p3');
    expect(bookingPerson({ ...base, personId: 'mgr', holderType: 'location' })).toBe('mgr');
  });
});

describe('uzávěrka a kapacita', () => {
  const slot = { startsAt: at(48), cancelledAt: null, capacity: 1, booked: 0 };
  it('24 h před začátkem je hranice', () => {
    expect(withinCutoff(at(24), NOW)).toBe(false);
    expect(withinCutoff(at(23.99), NOW)).toBe(true);
  });
  it('volný termín mimo uzávěrku jde rezervovat', () =>
    expect(slotDenial(slot, NOW, false)).toBeNull());
  it('plný termín nejde (ani správci)', () => {
    expect(slotDenial({ ...slot, booked: 1 }, NOW, false)).toMatch(/obsazený/);
    expect(slotDenial({ ...slot, booked: 1 }, NOW, true)).toMatch(/obsazený/);
  });
  it('kapacita 3 přijme třetí vozidlo, čtvrté ne', () => {
    expect(slotDenial({ ...slot, capacity: 3, booked: 2 }, NOW, false)).toBeNull();
    expect(slotDenial({ ...slot, capacity: 3, booked: 3 }, NOW, false)).toMatch(/obsazený/);
  });
  it('v uzávěrce nerezervuje uživatel, správce ano', () => {
    const soon = { ...slot, startsAt: at(5) };
    expect(slotDenial(soon, NOW, false)).toMatch(/24 h/);
    expect(slotDenial(soon, NOW, true)).toBeNull();
  });
  it('proběhlý ani zrušený termín nejde', () => {
    expect(slotDenial({ ...slot, startsAt: at(-1) }, NOW, true)).toMatch(/proběhl/);
    expect(slotDenial({ ...slot, cancelledAt: NOW }, NOW, true)).toMatch(/zrušen/);
  });
  it('zrušit/změnit jde jen aktivní rezervaci mimo uzávěrku', () => {
    expect(cancelDenial({ status: 'booked', startsAt: at(30) }, NOW, false)).toBeNull();
    expect(cancelDenial({ status: 'booked', startsAt: at(10) }, NOW, false)).toMatch(/24 h/);
    expect(cancelDenial({ status: 'booked', startsAt: at(10) }, NOW, true)).toBeNull();
    expect(cancelDenial({ status: 'done', startsAt: at(30) }, NOW, true)).toMatch(/aktivní/);
  });
});

describe('generateSlotTimes', () => {
  it('8:00–10:00 po 30 min = 4 termíny, zbytek se zahodí', () => {
    const s = new Date('2026-10-26T07:00:00Z');
    expect(generateSlotTimes(s, new Date(s.getTime() + 2 * H), 30)).toHaveLength(4);
    expect(generateSlotTimes(s, new Date(s.getTime() + 2 * H + 10 * 60_000), 30)).toHaveLength(4);
  });
  it('odmítne obrácené rozmezí, krátkou délku a víc než 100 termínů', () => {
    const s = new Date('2026-10-26T07:00:00Z');
    expect(() => generateSlotTimes(s, s, 30)).toThrow(/po začátku/);
    expect(() => generateSlotTimes(s, new Date(s.getTime() + H), 2)).toThrow(/5 až 1440/);
    expect(() => generateSlotTimes(s, new Date(s.getTime() + 200 * H), 60)).toThrow(/100/);
  });
  it('DTO validuje sezónu a kapacitu', async () => {
    const errs = await validate(
      plainToInstance(CreateTireSlotsDto, {
        startsAt: '2026-10-26T07:00:00Z',
        endsAt: '2026-10-26T15:00:00Z',
        durationMin: 30,
        capacity: 0,
        season: 'spring',
      }),
    );
    expect(errs.map((e) => e.property).sort()).toEqual(['capacity', 'season']);
  });
});

describe('pickSeasonSet', () => {
  const rows = [
    { setLabel: 'Letní', season: 'summer', mounted: true },
    { setLabel: 'Zimní', season: 'winter', mounted: false },
    { setLabel: 'Zimní', season: 'winter', mounted: false },
  ];
  it('najde sadu sezóny termínu', () => expect(pickSeasonSet(rows, 'winter')).toBe('Zimní'));
  it('bez sezóny nebo bez sady nic', () => {
    expect(pickSeasonSet(rows, null)).toBeNull();
    expect(pickSeasonSet(rows.slice(0, 1), 'winter')).toBeNull();
  });
  it('přednost má sada, která ještě není na kolech', () =>
    expect(
      pickSeasonSet(
        [
          { setLabel: 'A zimní', season: 'winter', mounted: true },
          { setLabel: 'B zimní', season: 'winter', mounted: false },
        ],
        'winter',
      ),
    ).toBe('B zimní'));
});

// --- Služba nad falešným SQL (pořadí kroků, zámky, Hotovo) ---

interface Fake {
  holder?: string;
  manager?: boolean;
  active?: boolean;
  slot?: { starts_at: Date; capacity: number; booked: number; season?: string | null };
  booking?: { status: string; starts_at: Date; season: string | null };
}

function setup(f: Fake = {}) {
  const calls: string[] = [];
  const slot = {
    id: 's1',
    starts_at: at(72),
    ends_at: at(72.5),
    location: 'Dílna',
    note: null,
    capacity: 1,
    season: 'winter',
    cancelled_at: null,
    booked: 0,
    ...f.slot,
  };
  const booking = {
    id: 'b1',
    slot_id: 's1',
    asset_id: 'a1',
    asset_name: 'Octavia',
    plate: '8AR 3517',
    person_id: 'p1',
    person_name: 'Jan',
    status: 'booked',
    starts_at: at(72),
    ends_at: at(72.5),
    location: 'Dílna',
    season: 'winter',
    ...f.booking,
  };
  const query = jest.fn(async (sql: string) => {
    const s = sql.replace(/\s+/g, ' ');
    calls.push(s);
    if (/FROM assets WHERE id = \$1 FOR UPDATE/.test(s)) return [];
    if (/FROM people p JOIN users/.test(s)) return [{ id: 'p1' }];
    if (/asset_categories/.test(s)) return [{ equipment_kind: 'vehicle' }];
    if (/b.asset_id = \$2 AND b.status = 'booked' LIMIT 1/.test(s))
      return f.active ? [booking] : [];
    if (/FROM tire_change_slots WHERE tenant_id = \$1 AND id = \$2 FOR UPDATE/.test(s))
      return [{ id: 's1' }];
    if (/FROM tire_change_slots s WHERE s.tenant_id = \$1 AND s.id = \$2/.test(s)) return [slot];
    if (/FROM tire_change_bookings WHERE tenant_id = \$1 AND id = \$2 FOR UPDATE/.test(s))
      return [{ id: 'b1' }];
    if (/INSERT INTO tire_change_bookings/.test(s)) return [{ id: 'b1' }];
    if (/WHERE b.tenant_id = \$1 AND b.id = \$2/.test(s)) return [booking];
    return [];
  });
  const context = { tenantId: 't1', scope: { type: 'ORGANIZATION' }, manager: { query } };
  const asset = {
    id: 'a1',
    name: 'Octavia',
    categoryId: 'c1',
    registrationPlate: '8AR 3517',
    currentHolderType: 'person',
    currentHolderId: f.holder ?? 'p1',
    responsiblePersonId: null,
  };
  const assets = {
    get: jest.fn(async () => asset),
    addService: jest.fn(async () => ({ id: 'svc1' })),
  };
  const tires = {
    list: jest.fn(async () => [
      { setLabel: 'Letní', season: 'summer', mounted: true },
      { setLabel: 'Zimní', season: 'winter', mounted: false },
    ]),
    mount: jest.fn(async () => []),
  };
  const authz = { can: jest.fn(async () => ({ allowed: !!f.manager })) };
  const audit = { record: jest.fn(async () => undefined) };
  const svc = new TireSlotsService(
    context as never,
    assets as never,
    tires as never,
    authz as never,
    audit as never,
  );
  const user = { userId: 'u1', tenantId: 't1', tenantRole: 'viewer' };
  return { svc, calls, assets, tires, audit, user };
}

describe('TireSlotsService', () => {
  beforeAll(() => jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate'] }));
  afterAll(() => jest.useRealTimers());

  it('držitel zarezervuje volný termín: zamkne vozidlo i termín a zapíše rezervaci', async () => {
    const { svc, calls, user } = setup();
    const res = await svc.book(user, 's1', 'a1');
    expect(res.id).toBe('b1');
    const lockSlot = calls.findIndex((c) => /tire_change_slots .*FOR UPDATE/.test(c));
    const insert = calls.findIndex((c) => /INSERT INTO tire_change_bookings/.test(c));
    expect(calls[0]).toMatch(/FROM assets WHERE id = \$1 FOR UPDATE/);
    expect(lockSlot).toBeGreaterThan(0);
    expect(insert).toBeGreaterThan(lockSlot);
  });

  it('plný termín odmítne bez zápisu', async () => {
    const { svc, calls, user } = setup({ slot: { starts_at: at(72), capacity: 1, booked: 1 } });
    await expect(svc.book(user, 's1', 'a1')).rejects.toThrow(BadRequestException);
    expect(calls.some((c) => /INSERT/.test(c))).toBe(false);
  });

  it('druhou aktivní rezervaci vozidla odmítne (unikátní rezervace)', async () => {
    const { svc, user } = setup({ active: true });
    await expect(svc.book(user, 's1', 'a1')).rejects.toThrow(/už má termín/);
  });

  it('cizí vozidlo uživatel bez správy nezarezervuje', async () => {
    const { svc, user } = setup({ holder: 'p9' });
    await expect(svc.book(user, 's1', 'a1')).rejects.toThrow(ForbiddenException);
  });

  it('zrušení v posledních 24 h odmítne', async () => {
    const { svc, user } = setup({ booking: { status: 'booked', starts_at: at(3), season: null } });
    await expect(svc.cancel(user, 'b1')).rejects.toThrow(/24 h/);
  });

  it('Hotovo přezuje na zimní sadu, zapíše servis a uzavře rezervaci', async () => {
    const { svc, calls, tires, assets, user } = setup({ manager: true });
    const res = await svc.complete(user, 'b1');
    expect(res).toEqual({ done: true, mountedSet: 'Zimní', serviceRecordId: 'svc1' });
    expect(tires.mount).toHaveBeenCalledWith('a1', 'Zimní');
    expect(assets.addService).toHaveBeenCalledWith(
      'a1',
      expect.objectContaining({
        kind: 'service',
        note: expect.stringMatching(/na zimní – sada „Zimní“/),
      }),
    );
    expect(calls.some((c) => /SET status = 'done'/.test(c))).toBe(true);
  });

  it('Hotovo bez sezóny termínu nic nepřezouvá, jen servis', async () => {
    const { svc, tires, user } = setup({
      manager: true,
      booking: { status: 'booked', starts_at: at(72), season: null },
    });
    const res = await svc.complete(user, 'b1');
    expect(res.mountedSet).toBeNull();
    expect(tires.mount).not.toHaveBeenCalled();
  });
});
