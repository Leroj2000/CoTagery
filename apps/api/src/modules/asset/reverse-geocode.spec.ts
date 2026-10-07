import { formatReverseAddress } from './reverse-geocode';

describe('formatReverseAddress', () => {
  it('sestaví ulici, číslo, PSČ a obec', () => {
    expect(
      formatReverseAddress({
        address: { road: 'Dlouhá', house_number: '12/4', postcode: '110 00', city: 'Praha' },
      }),
    ).toBe('Dlouhá 12/4, 110 00 Praha');
  });

  it('funguje i bez čísla domu', () => {
    expect(formatReverseAddress({ address: { road: 'Polní', village: 'Lhota' } })).toBe(
      'Polní, Lhota',
    );
  });

  it('použije zkrácený display_name, když chybí strukturovaná adresa', () => {
    expect(formatReverseAddress({ display_name: 'Bod, Oblast, Česko, Evropa' })).toBe(
      'Bod, Oblast, Česko',
    );
  });
});
