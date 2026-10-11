import { mapHeader } from './asset-io.logic';
import { normalizePlate } from './plate.logic';

describe('SPZ', () => {
  it('sjednotí zápis', () => {
    expect(normalizePlate(' 1ab  2345 ')).toBe('1AB 2345');
    expect(normalizePlate('5a9 1234')).toBe('5A9 1234');
    expect(normalizePlate('   ')).toBeNull();
    expect(normalizePlate(undefined)).toBeNull();
  });

  it('hlavička importu: SPZ, RZ, registrační značka', () => {
    expect(mapHeader(['SPZ', 'Výrobní číslo']).index).toEqual({
      registrationPlate: 0,
      serialNumber: 1,
    });
    expect(mapHeader(['Registrační značka']).index).toEqual({ registrationPlate: 0 });
    expect(mapHeader(['RZ']).index).toEqual({ registrationPlate: 0 });
  });
});
