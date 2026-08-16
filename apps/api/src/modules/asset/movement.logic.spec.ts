import {
  applyMovement,
  initialState,
  availableActions,
  MovementError,
  type AssetState,
} from './movement.logic';

const HOME = 'loc-home';
const SITE = 'loc-site';
const PERSON = 'per-jan';
const PERSON2 = 'per-petr';

function fresh(): AssetState {
  return initialState(HOME);
}

describe('movement.logic – stavový automat Asset/Movement', () => {
  it('initialState: dostupný v domovské lokaci', () => {
    expect(fresh()).toEqual({
      status: 'available',
      holderType: 'location',
      holderId: HOME,
      responsiblePersonId: null,
      dueAt: null,
    });
  });

  it('LOAN → loaned, holder=osoba, responsible=osoba, dueAt', () => {
    const due = new Date('2026-09-01T00:00:00Z');
    const s = applyMovement(fresh(), { type: 'loan', toType: 'person', toId: PERSON, dueAt: due });
    expect(s.status).toBe('loaned');
    expect(s.holderType).toBe('person');
    expect(s.holderId).toBe(PERSON);
    expect(s.responsiblePersonId).toBe(PERSON);
    expect(s.dueAt).toBe(due);
  });

  it('RETURN → available, holder=home location, dueAt=null', () => {
    const loaned = applyMovement(fresh(), { type: 'loan', toType: 'person', toId: PERSON });
    const s = applyMovement(loaned, { type: 'return', homeLocationId: HOME });
    expect(s.status).toBe('available');
    expect(s.holderType).toBe('location');
    expect(s.holderId).toBe(HOME);
    expect(s.responsiblePersonId).toBeNull();
    expect(s.dueAt).toBeNull();
  });

  it('nelze půjčit už půjčenou věc', () => {
    const loaned = applyMovement(fresh(), { type: 'loan', toType: 'person', toId: PERSON });
    expect(() => applyMovement(loaned, { type: 'loan', toType: 'person', toId: PERSON2 })).toThrow(
      MovementError,
    );
  });

  it('HANDOVER: půjčené předá dál na jinou osobu', () => {
    const loaned = applyMovement(fresh(), { type: 'loan', toType: 'person', toId: PERSON });
    const s = applyMovement(loaned, { type: 'handover', toType: 'person', toId: PERSON2 });
    expect(s.status).toBe('loaned');
    expect(s.holderId).toBe(PERSON2);
  });

  it('MOVE: přesun na jinou lokaci → available na novém místě', () => {
    const s = applyMovement(fresh(), { type: 'move', toType: 'location', toId: SITE });
    expect(s.status).toBe('available');
    expect(s.holderId).toBe(SITE);
  });

  it('SERVICE_OUT → service, SERVICE_RETURN → available', () => {
    const out = applyMovement(fresh(), { type: 'service_out', toType: 'location', toId: SITE });
    expect(out.status).toBe('service');
    const back = applyMovement(out, { type: 'service_return', homeLocationId: HOME });
    expect(back.status).toBe('available');
    expect(back.holderId).toBe(HOME);
  });

  it('service_return jen ze stavu service', () => {
    expect(() => applyMovement(fresh(), { type: 'service_return', toId: HOME })).toThrow(
      /není v servisu/,
    );
  });

  it('DISPOSE → retired, bez holdera; retired už nic nedovolí', () => {
    const disposed = applyMovement(fresh(), { type: 'dispose' });
    expect(disposed.status).toBe('retired');
    expect(disposed.holderId).toBeNull();
    expect(() => applyMovement(disposed, { type: 'move', toId: SITE })).toThrow(/Vyřazený/);
  });

  it('ASSIGN na lokaci i osobu', () => {
    const toPerson = applyMovement(fresh(), { type: 'assign', toType: 'person', toId: PERSON });
    expect(toPerson.status).toBe('assigned');
    expect(toPerson.holderType).toBe('person');
    const toLoc = applyMovement(fresh(), { type: 'assign', toType: 'location', toId: SITE });
    expect(toLoc.status).toBe('assigned');
    expect(toLoc.holderType).toBe('location');
  });

  it('vrácení bez cíle a bez home location vyhodí to_required', () => {
    const noHome = initialState(null);
    const loaned = applyMovement(noHome, { type: 'loan', toType: 'person', toId: PERSON });
    expect(() => applyMovement(loaned, { type: 'return' })).toThrow(/Chybí/);
  });

  it('availableActions: kontextové akce dle stavu', () => {
    expect(availableActions('available')).toContain('loan');
    expect(availableActions('loaned')).toEqual(['return', 'handover', 'service_out']);
    expect(availableActions('retired')).toEqual([]);
  });
});
