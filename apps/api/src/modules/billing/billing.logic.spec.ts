import {
  computeVat,
  subscriptionStatusToMembership,
  signWebhook,
  verifyWebhookSignature,
} from './billing.logic';

describe('billing.logic', () => {
  describe('computeVat', () => {
    it('standardní 21 % sazba', () => {
      expect(computeVat('100', 21, false)).toEqual({
        vatAmount: '21.00',
        vatRate: '21',
        gross: '121.00',
      });
    });

    it('reverse charge → 0 % a nulová DPH', () => {
      expect(computeVat('100', 21, true)).toEqual({
        vatAmount: '0.00',
        vatRate: '0',
        gross: '100.00',
      });
    });
  });

  describe('subscriptionStatusToMembership', () => {
    it('active/trialing/past_due → active (grace drží členství)', () => {
      expect(subscriptionStatusToMembership('active')).toBe('active');
      expect(subscriptionStatusToMembership('trialing')).toBe('active');
      expect(subscriptionStatusToMembership('past_due')).toBe('active');
    });

    it('canceled → cancelled, incomplete → suspended', () => {
      expect(subscriptionStatusToMembership('canceled')).toBe('cancelled');
      expect(subscriptionStatusToMembership('incomplete')).toBe('suspended');
    });
  });

  describe('webhook podpis', () => {
    const secret = 'whsec_test';
    const body = JSON.stringify({ id: 'evt_1', type: 'invoice.paid' });

    it('platný podpis projde', () => {
      const sig = signWebhook(body, secret);
      expect(verifyWebhookSignature(body, sig, secret)).toBe(true);
    });

    it('pozměněný payload neprojde', () => {
      const sig = signWebhook(body, secret);
      expect(verifyWebhookSignature(body + 'x', sig, secret)).toBe(false);
    });

    it('špatný secret neprojde', () => {
      const sig = signWebhook(body, secret);
      expect(verifyWebhookSignature(body, sig, 'whsec_wrong')).toBe(false);
    });

    it('prázdný podpis neprojde', () => {
      expect(verifyWebhookSignature(body, '', secret)).toBe(false);
    });
  });
});
