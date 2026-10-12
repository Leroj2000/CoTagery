import {
  allowedEntitlements,
  effectivePlanKey,
  entitlementLock,
  extendSubscription,
  invoiceAmounts,
  nextInvoiceNumber,
  resolveLimits,
  sanitizeEntitlementOverrides,
  sanitizeLimits,
  settleSubscription,
  withinLimit,
  type SubscriptionState,
} from './plans.logic';

const base: SubscriptionState = {
  planKey: 'start',
  status: 'active',
  periodStart: '2026-09-01',
  periodEnd: '2026-09-30',
  cancelAtPeriodEnd: false,
};

describe('plans.logic – životní cyklus', () => {
  it('zkušební doba po konci → Free bez konce', () => {
    const trial = { ...base, planKey: 'trial', status: 'trialing' as const };
    expect(settleSubscription(trial, '2026-09-30', 14)).toBe(trial);
    expect(settleSubscription(trial, '2026-10-01', 14)).toMatchObject({
      planKey: 'free',
      status: 'active',
      periodEnd: null,
    });
  });

  it('aktivní → po splatnosti → po grace pozastaveno', () => {
    expect(settleSubscription(base, '2026-09-30', 14).status).toBe('active');
    expect(settleSubscription(base, '2026-10-01', 14).status).toBe('past_due');
    expect(settleSubscription(base, '2026-10-14', 14).status).toBe('past_due');
    expect(settleSubscription(base, '2026-10-15', 14).status).toBe('suspended');
  });

  it('zrušení ke konci období → zrušeno', () => {
    expect(settleSubscription({ ...base, cancelAtPeriodEnd: true }, '2026-10-01', 14).status).toBe(
      'canceled',
    );
  });

  it('bez konce období nikdy nevyprší', () => {
    expect(settleSubscription({ ...base, periodEnd: null }, '2030-01-01', 14).status).toBe(
      'active',
    );
  });

  it('pozastavené a zrušené se řídí úrovní Free', () => {
    expect(effectivePlanKey({ planKey: 'pro', status: 'suspended' })).toBe('free');
    expect(effectivePlanKey({ planKey: 'pro', status: 'canceled' })).toBe('free');
    expect(effectivePlanKey({ planKey: 'pro', status: 'past_due' })).toBe('pro');
  });

  it('prodloužení navazuje na konec období i po splatnosti', () => {
    const suspended = { ...base, status: 'suspended' as const };
    expect(extendSubscription(suspended, 30, '2026-10-20')).toMatchObject({
      periodEnd: '2026-10-30',
      status: 'active',
    });
    // nestačí přes dnešek → stav se nemění
    expect(extendSubscription(suspended, 10, '2026-10-20')).toMatchObject({
      periodEnd: '2026-10-10',
      status: 'suspended',
    });
    // zkušební doba zůstává zkušební
    const trial = { ...base, planKey: 'trial', status: 'trialing' as const };
    expect(extendSubscription(trial, 7, '2026-09-20')).toMatchObject({
      periodEnd: '2026-10-07',
      status: 'trialing',
    });
    // bez konce → od dneška
    expect(extendSubscription({ ...base, periodEnd: null }, 30, '2026-10-12').periodEnd).toBe(
      '2026-11-11',
    );
  });
});

describe('plans.logic – moduly a limity', () => {
  const plan = {
    key: 'start',
    entitlements: ['inventory', 'branding'],
    limits: { assets: 500, users: 5 },
  };

  it('výjimka superadmina má přednost před úrovní', () => {
    const allowed = allowedEntitlements(plan, { vehicles: 'enabled', branding: 'disabled' });
    expect(allowed.inventory).toBe(true);
    expect(allowed.vehicles).toBe(true);
    expect(allowed.branding).toBe(false);
    expect(allowed.rental).toBe(false);
    expect(entitlementLock('branding', plan, { branding: 'disabled' })).toBe(
      'disabled_by_platform',
    );
    expect(entitlementLock('rental', plan, {})).toBe('not_in_plan');
    expect(entitlementLock('inventory', plan, {})).toBeNull();
  });

  it('limity: výjimka (i neomezeno) > úroveň, chybějící = neomezeno', () => {
    const limits = resolveLimits(plan, { assets: 800, users: null });
    expect(limits).toMatchObject({ assets: 800, users: null, carriers: null });
    expect(withinLimit(500, 499)).toBe(true);
    expect(withinLimit(500, 500)).toBe(false);
    expect(withinLimit(500, 495, 10)).toBe(false);
    expect(withinLimit(null, 1e9)).toBe(true);
  });

  it('očištění vstupů', () => {
    expect(sanitizeLimits({ assets: 10, users: null, xxx: 1 })).toEqual({
      assets: 10,
      users: null,
    });
    expect(() => sanitizeLimits({ assets: -1 })).toThrow();
    expect(() => sanitizeLimits({ assets: 1.5 })).toThrow();
    expect(sanitizeEntitlementOverrides({ rental: 'enabled', ai: null })).toEqual({
      rental: 'enabled',
    });
    expect(() => sanitizeEntitlementOverrides({ hack: 'enabled' })).toThrow();
  });
});

describe('plans.logic – faktury', () => {
  it('DPH podle plátcovství', () => {
    expect(invoiceAmounts(790, { payer: true, rate: 21 })).toEqual({
      amountNet: 790,
      vatRate: 21,
      amountVat: 165.9,
      amountGross: 955.9,
    });
    expect(invoiceAmounts(790, { payer: false, rate: 21 })).toEqual({
      amountNet: 790,
      vatRate: null,
      amountVat: 0,
      amountGross: 790,
    });
  });

  it('číselná řada po rocích', () => {
    expect(nextInvoiceNumber(2026, [])).toBe('20260001');
    expect(nextInvoiceNumber(2026, ['20260001', '20260007', '20250099'])).toBe('20260008');
    expect(nextInvoiceNumber(2027, ['20260008'])).toBe('20270001');
  });
});
