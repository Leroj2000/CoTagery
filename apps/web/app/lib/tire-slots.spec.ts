import { fmtSlot, fmtSlotShort, seasonLabel } from './tire-slots';

describe('tire-slots formát', () => {
  it('zobrazí termín v čase firmy (Praha, zimní čas)', () => {
    // 26. 10. 2026 je pondělí, 07:00Z = 8:00 v Praze (SEČ).
    expect(fmtSlot('2026-10-26T07:00:00Z', '2026-10-26T07:30:00Z')).toBe('po 26. 10. 8:00–8:30');
    expect(fmtSlotShort('2026-10-26T07:00:00Z')).toBe('po 26. 10. 8:00');
  });
  it('popisek sezóny', () => {
    expect(seasonLabel('winter')).toBe('Přezutí na zimní');
    expect(seasonLabel(null)).toBeNull();
  });
});
