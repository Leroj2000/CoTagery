import { canTransition, isBlocking, OWNER_ACTIONS } from './order-status.logic';

describe('order-status state machine', () => {
  it('povolí platnou cestu awaiting_payment → completed', () => {
    expect(canTransition('awaiting_payment', 'paid')).toBe(true);
    expect(canTransition('paid', 'picked_up')).toBe(true);
    expect(canTransition('picked_up', 'returned')).toBe(true);
    expect(canTransition('returned', 'completed')).toBe(true);
  });

  it('odmítne neplatné přeskočení stavů', () => {
    expect(canTransition('awaiting_payment', 'picked_up')).toBe(false);
    expect(canTransition('awaiting_payment', 'completed')).toBe(false);
    expect(canTransition('picked_up', 'cancelled')).toBe(false);
  });

  it('terminální stavy nemají žádný přechod', () => {
    expect(canTransition('completed', 'returned')).toBe(false);
    expect(canTransition('cancelled', 'paid')).toBe(false);
    expect(canTransition('expired', 'paid')).toBe(false);
  });

  it('lze zrušit objednávku před vyzvednutím', () => {
    expect(canTransition('awaiting_payment', 'cancelled')).toBe(true);
    expect(canTransition('paid', 'cancelled')).toBe(true);
    expect(canTransition('confirmed', 'cancelled')).toBe(true);
  });

  it('mapování akcí majitele na cílové stavy', () => {
    expect(OWNER_ACTIONS.confirm_payment).toBe('paid');
    expect(OWNER_ACTIONS.pickup).toBe('picked_up');
    expect(OWNER_ACTIONS.return).toBe('returned');
    expect(OWNER_ACTIONS.cancel).toBe('cancelled');
  });

  it('blokující stavy drží věc rezervovanou', () => {
    expect(isBlocking('awaiting_payment')).toBe(true);
    expect(isBlocking('picked_up')).toBe(true);
    expect(isBlocking('returned')).toBe(false);
    expect(isBlocking('cancelled')).toBe(false);
  });
});
