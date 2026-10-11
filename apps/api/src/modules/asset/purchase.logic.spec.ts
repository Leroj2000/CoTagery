import {
  addMonths,
  computePrice,
  decodeFileName,
  isIsoDate,
  tenantIsVatPayer,
  tenantVatRate,
  todayInPrague,
  warrantyEnd,
  warrantyStatus,
} from './purchase.logic';

describe('purchase.logic', () => {
  describe('computePrice', () => {
    it('plátce: z ceny bez DPH dopočítá cenu s DPH', () => {
      expect(computePrice({ amount: 1000, includesVat: false, vatRate: 21 })).toEqual({
        priceNet: 1000,
        vatRate: 21,
        priceGross: 1210,
      });
    });

    it('neplátce: z ceny s DPH dopočítá základ (zaokrouhleno na haléře)', () => {
      expect(computePrice({ amount: 999.99, includesVat: true, vatRate: 21 })).toEqual({
        priceNet: 826.44,
        vatRate: 21,
        priceGross: 999.99,
      });
    });

    it('bez sazby uloží jen zadanou cenu', () => {
      expect(computePrice({ amount: 500, includesVat: true, vatRate: null })).toEqual({
        priceNet: null,
        vatRate: null,
        priceGross: 500,
      });
    });

    it('sazba 0 % = obě ceny stejné', () => {
      expect(computePrice({ amount: 300, includesVat: true, vatRate: 0 })).toMatchObject({
        priceNet: 300,
        priceGross: 300,
      });
    });

    it('bez částky nic nepočítá', () => {
      expect(computePrice({ amount: null, includesVat: false, vatRate: 21 })).toEqual({
        priceNet: null,
        vatRate: 21,
        priceGross: null,
      });
    });
  });

  describe('záruka', () => {
    it('addMonths zarovná konec měsíce', () => {
      expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
      expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
      expect(addMonths('2026-03-01', 24)).toBe('2028-03-01');
      expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
    });

    it('konec = zadané datum, jinak začátek + měsíce', () => {
      expect(warrantyEnd({ startsOn: '2026-03-01', months: 24, endsOn: null })).toBe('2028-03-01');
      expect(warrantyEnd({ startsOn: '2026-03-01', months: 24, endsOn: '2027-01-01' })).toBe(
        '2027-01-01',
      );
      expect(warrantyEnd({ startsOn: null, months: 24, endsOn: null })).toBeNull();
    });

    it('stav: platí do posledního dne, 30 dní předem „končí"', () => {
      expect(warrantyStatus('2026-10-11', '2026-10-11')).toBe('expiring');
      expect(warrantyStatus('2026-10-10', '2026-10-11')).toBe('expired');
      expect(warrantyStatus('2026-11-10', '2026-10-11')).toBe('expiring');
      expect(warrantyStatus('2026-11-11', '2026-10-11')).toBe('active');
    });

    it('isIsoDate odmítne neplatné datum', () => {
      expect(isIsoDate('2026-02-29')).toBe(false);
      expect(isIsoDate('2028-02-29')).toBe(true);
      expect(isIsoDate('1.3.2026')).toBe(false);
    });

    it('dnešek v Praze (po půlnoci SELČ je už další den)', () => {
      expect(todayInPrague(new Date('2026-10-10T22:30:00Z'))).toBe('2026-10-11');
    });
  });

  it('nastavení firmy: plátce a sazba s rozumným výchozím', () => {
    expect(tenantIsVatPayer({ vatPayer: true })).toBe(true);
    expect(tenantIsVatPayer({})).toBe(false);
    expect(tenantVatRate({ defaultVatRate: 12 })).toBe(12);
    expect(tenantVatRate({ defaultVatRate: 'x' })).toBe(21);
    expect(tenantVatRate(null)).toBe(21);
  });

  it('název souboru: opraví latin1 mojibake, platné UTF-8 nechá', () => {
    const mojibake = Buffer.from('záruční list.pdf', 'utf8').toString('latin1');
    expect(decodeFileName(mojibake)).toBe('záruční list.pdf');
    expect(decodeFileName('záruční list.pdf')).toBe('záruční list.pdf');
    expect(decodeFileName('faktura.pdf')).toBe('faktura.pdf');
    expect(decodeFileName('caf\u00e9.pdf')).toBe('café.pdf');
  });
});
