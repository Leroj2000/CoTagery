import { buildSpayd } from './spayd';

describe('buildSpayd', () => {
  it('sestaví SPAYD s IBAN, částkou, měnou, VS a zprávou', () => {
    const s = buildSpayd({
      iban: 'CZ6508000000192000145399',
      amount: '1900',
      currency: 'CZK',
      vs: 42,
      message: 'Pujcovna objednavka',
    });
    expect(s).toBe(
      'SPD*1.0*ACC:CZ6508000000192000145399*AM:1900.00*CC:CZK*X-VS:42*MSG:Pujcovna objednavka',
    );
  });

  it('normalizuje IBAN (mezery, malá písmena) a zaokrouhlí částku na 2 desetinná místa', () => {
    const s = buildSpayd({ iban: 'cz65 0800 0000 1920 0014 5399', amount: 1234.5, currency: 'czk' });
    expect(s).toContain('ACC:CZ6508000000192000145399');
    expect(s).toContain('AM:1234.50');
    expect(s).toContain('CC:CZK');
  });

  it('vynechá VS a MSG, když nejsou zadané', () => {
    const s = buildSpayd({ iban: 'CZ6508000000192000145399', amount: '100', currency: 'CZK' });
    expect(s).not.toContain('X-VS');
    expect(s).not.toContain('MSG');
  });

  it('odstraní hvězdičku a diakritiku ze zprávy', () => {
    const s = buildSpayd({
      iban: 'CZ6508000000192000145399',
      amount: '1',
      currency: 'CZK',
      message: 'Půjčka*věci',
    });
    expect(s).toContain('MSG:Pujcka veci');
  });

  it('vyhodí chybu pro neplatný IBAN', () => {
    expect(() => buildSpayd({ iban: '12345', amount: '1', currency: 'CZK' })).toThrow('invalid_iban');
  });
});
