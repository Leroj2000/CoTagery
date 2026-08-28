import { MAX_SPEC_ITEMS, buildSpecPayload, sanitizeSpecs } from './specs.logic';

describe('specs.logic', () => {
  describe('sanitizeSpecs', () => {
    it('nechá jen platné {label,value} a ořízne prázdné', () => {
      const r = sanitizeSpecs([
        { label: 'Výkon', value: '650 W' },
        { label: '', value: 'x' },
        { label: 'Hmotnost', value: '' },
        { label: 'Napětí', value: '230 V' },
        'nesmysl',
      ]);
      expect(r).toEqual([
        { label: 'Výkon', value: '650 W' },
        { label: 'Napětí', value: '230 V' },
      ]);
    });

    it('vrátí [] pro ne-pole', () => {
      expect(sanitizeSpecs(null)).toEqual([]);
      expect(sanitizeSpecs({})).toEqual([]);
    });

    it('omezí počet položek', () => {
      const many = Array.from({ length: 100 }, (_, i) => ({ label: `L${i}`, value: `V${i}` }));
      expect(sanitizeSpecs(many)).toHaveLength(MAX_SPEC_ITEMS);
    });

    it('ořízne příliš dlouhé hodnoty', () => {
      const r = sanitizeSpecs([{ label: 'x'.repeat(200), value: 'y'.repeat(1000) }]);
      expect(r[0].label.length).toBe(120);
      expect(r[0].value.length).toBe(400);
    });
  });

  describe('buildSpecPayload', () => {
    it('sestaví callbackUrl na /specs/webhook/callback a normalizuje base', () => {
      const p = buildSpecPayload({
        specId: 's1',
        assetId: 'a1',
        tenantId: 't1',
        name: 'Vrtačka',
        manufacturer: 'Bosch',
        callbackBaseUrl: 'http://tagery-api-1:3001/',
      });
      expect(p.callbackUrl).toBe('http://tagery-api-1:3001/api/v1/specs/webhook/callback');
      expect(p.manufacturer).toBe('Bosch');
      expect(p.model).toBeNull();
    });
  });
});
