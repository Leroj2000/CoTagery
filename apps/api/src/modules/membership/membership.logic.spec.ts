import { computeEffectiveStatus, isMembershipActive, extendValidTo } from './membership.logic';

describe('membership.logic', () => {
  const now = new Date('2026-06-01T12:00:00Z');
  const future = new Date('2026-12-01T00:00:00Z');
  const past = new Date('2026-05-01T00:00:00Z');

  describe('computeEffectiveStatus', () => {
    it('platné do budoucna → active', () => {
      expect(computeEffectiveStatus('active', future, now)).toBe('active');
    });

    it('po expiraci bez grace → expired', () => {
      expect(computeEffectiveStatus('active', past, now)).toBe('expired');
    });

    it('v rámci grace periody → stále active', () => {
      const yesterday = new Date('2026-05-31T12:00:00Z');
      expect(computeEffectiveStatus('active', yesterday, now, 7)).toBe('active');
    });

    it('po vypršení grace → expired', () => {
      expect(computeEffectiveStatus('active', past, now, 7)).toBe('expired');
    });

    it('suspended/cancelled má přednost i při platnosti do budoucna', () => {
      expect(computeEffectiveStatus('suspended', future, now)).toBe('suspended');
      expect(computeEffectiveStatus('cancelled', future, now)).toBe('cancelled');
    });

    it('cancelled nedostává grace', () => {
      const yesterday = new Date('2026-05-31T12:00:00Z');
      expect(computeEffectiveStatus('cancelled', yesterday, now, 7)).toBe('cancelled');
    });
  });

  describe('isMembershipActive', () => {
    it('pustí jen aktivní', () => {
      expect(isMembershipActive('active', future, now)).toBe(true);
      expect(isMembershipActive('active', past, now)).toBe(false);
      expect(isMembershipActive('suspended', future, now)).toBe(false);
    });
  });

  describe('extendValidTo', () => {
    it('prodlouží od stávajícího validTo, když je v budoucnu', () => {
      expect(extendValidTo(future, 30, now)).toEqual(new Date('2026-12-31T00:00:00Z'));
    });

    it('prodlouží od teď, když už členství expirovalo', () => {
      expect(extendValidTo(past, 30, now)).toEqual(new Date('2026-07-01T12:00:00Z'));
    });
  });
});
