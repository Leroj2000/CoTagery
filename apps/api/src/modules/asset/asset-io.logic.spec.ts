import {
  decodeCsv,
  detectDelimiter,
  formatCzNumber,
  mapHeader,
  parseCsvFile,
  parseDate,
  parseNumber,
  resolveImportPrice,
} from './asset-io.logic';

describe('asset-io.logic', () => {
  it('hlavičky: české, anglické i bez diakritiky', () => {
    const m = mapHeader([
      'Název',
      'inventoryNumber',
      'VYROBNI CISLO',
      'Cena s DPH',
      'Barva',
      'nazev',
    ]);
    expect(m.index).toMatchObject({ name: 0, inventoryNumber: 1, serialNumber: 2, priceGross: 3 });
    expect(m.unknown).toEqual(['Barva']);
    expect(m.duplicate).toEqual(['nazev']);
  });

  it('oddělovač: středník, čárka, tabulátor (mimo uvozovky)', () => {
    expect(detectDelimiter('Název;Kategorie\na;b')).toBe(';');
    expect(detectDelimiter('name,category\n')).toBe(',');
    expect(detectDelimiter('"a;b;c",x,y\n')).toBe(',');
    expect(detectDelimiter('a\tb\tc')).toBe('\t');
  });

  it('kódování: UTF-8 s BOM i Windows-1250 z českého Excelu', () => {
    expect(decodeCsv(Buffer.from('﻿Název;Výrobce', 'utf8'))).toBe('Název;Výrobce');
    // „Vrtačka;Nářadí" v cp1250
    const cp1250 = Buffer.from([
      0x56, 0x72, 0x74, 0x61, 0xe8, 0x6b, 0x61, 0x3b, 0x4e, 0xe1, 0xf8, 0x61, 0x64, 0xed,
    ]);
    expect(decodeCsv(cp1250)).toBe('Vrtačka;Nářadí');
  });

  it('CSV soubor z Excelu se rozparsuje celý', () => {
    const rows = parseCsvFile(
      Buffer.from('﻿Název;Cena s DPH\r\n"Bruska; velká";"1 210,50"\r\n', 'utf8'),
    );
    expect(rows).toEqual([
      ['Název', 'Cena s DPH'],
      ['Bruska; velká', '1 210,50'],
    ]);
  });

  it('čísla v českém i anglickém zápisu', () => {
    expect(parseNumber('12 345,50 Kč')).toBe(12345.5);
    expect(parseNumber('12 345,5')).toBe(12345.5);
    expect(parseNumber('1.234,50')).toBe(1234.5);
    expect(parseNumber('1,234.50')).toBe(1234.5);
    expect(parseNumber('21 %')).toBe(21);
    expect(parseNumber('')).toBeNull();
    expect(Number.isNaN(parseNumber('abc'))).toBe(true);
    expect(formatCzNumber(1210.5)).toBe('1210,5');
  });

  it('data: 1.3.2026, 1. 3. 2026, ISO, neplatné', () => {
    expect(parseDate('1.3.2026')).toBe('2026-03-01');
    expect(parseDate('1. 3. 2026')).toBe('2026-03-01');
    expect(parseDate('2026-03-01')).toBe('2026-03-01');
    expect(parseDate('2026-03-01T00:00:00.000Z')).toBe('2026-03-01');
    expect(parseDate('31.2.2026')).toBe('invalid');
    expect(parseDate('březen')).toBe('invalid');
    expect(parseDate('')).toBeNull();
  });

  describe('ceny z importu', () => {
    const payer = { payer: true, defaultRate: 21 };
    const nonPayer = { payer: false, defaultRate: 21 };
    it('nic nevyplněno = beze změny', () => {
      expect(resolveImportPrice({ net: null, gross: null, rate: null }, null, payer)).toBeNull();
    });
    it('plátce: jen cena bez DPH → dopočítá s DPH sazbou firmy', () => {
      expect(resolveImportPrice({ net: 1000, gross: null, rate: null }, null, payer)).toEqual({
        priceNet: 1000,
        vatRate: 21,
        priceGross: 1210,
      });
    });
    it('neplátce: jen cena s DPH bez sazby → bez rozpisu', () => {
      expect(resolveImportPrice({ net: null, gross: 500, rate: null }, null, nonPayer)).toEqual({
        priceNet: null,
        vatRate: null,
        priceGross: 500,
      });
    });
    it('obě ceny → uloží se jak jsou, sazba se odvodí', () => {
      expect(resolveImportPrice({ net: 1000, gross: 1120, rate: null }, null, payer)).toEqual({
        priceNet: 1000,
        vatRate: 12,
        priceGross: 1120,
      });
    });
    it('jen sazba → přepočet stávající ceny', () => {
      expect(
        resolveImportPrice(
          { net: null, gross: null, rate: 12 },
          { priceNet: 1000, vatRate: 21, priceGross: 1210 },
          payer,
        ),
      ).toEqual({ priceNet: 1000, vatRate: 12, priceGross: 1120 });
    });
  });
});
