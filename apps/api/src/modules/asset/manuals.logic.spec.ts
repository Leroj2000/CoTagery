import {
  MANUAL_MAX_BYTES,
  buildFetchPayload,
  isAllowedManualMime,
  normalizeSource,
  signManualPayload,
  validateManualFile,
  verifyManualSignature,
} from './manuals.logic';

describe('manuals.logic', () => {
  describe('isAllowedManualMime', () => {
    it('povolí PDF a obrázky', () => {
      expect(isAllowedManualMime('application/pdf')).toBe(true);
      expect(isAllowedManualMime('image/jpeg')).toBe(true);
      expect(isAllowedManualMime('image/png')).toBe(true);
    });
    it('zamítne ostatní typy', () => {
      expect(isAllowedManualMime('video/mp4')).toBe(false);
      expect(isAllowedManualMime('application/zip')).toBe(false);
      expect(isAllowedManualMime('text/html')).toBe(false);
    });
  });

  describe('validateManualFile', () => {
    it('projde validní PDF', () => {
      expect(validateManualFile('application/pdf', 1024)).toBeNull();
    });
    it('zamítne nepodporovaný typ', () => {
      expect(validateManualFile('application/zip', 1024)).toMatch(/Nepodporovaný/);
    });
    it('zamítne prázdný soubor', () => {
      expect(validateManualFile('application/pdf', 0)).toMatch(/Prázdný/);
    });
    it('zamítne příliš velký soubor', () => {
      expect(validateManualFile('application/pdf', MANUAL_MAX_BYTES + 1)).toMatch(/velký/);
    });
    it('přijme soubor přesně na limitu', () => {
      expect(validateManualFile('application/pdf', MANUAL_MAX_BYTES)).toBeNull();
    });
  });

  describe('normalizeSource', () => {
    it('mapuje camera', () => {
      expect(normalizeSource('camera')).toBe('camera');
    });
    it('default upload pro cokoli jiného', () => {
      expect(normalizeSource(undefined)).toBe('upload');
      expect(normalizeSource('upload')).toBe('upload');
      expect(normalizeSource('nonsense')).toBe('upload');
    });
  });

  describe('buildFetchPayload', () => {
    it('sestaví payload s callback URL a null pro chybějící pole', () => {
      const p = buildFetchPayload({
        manualId: 'm1',
        assetId: 'a1',
        tenantId: 't1',
        name: 'Vrtačka',
        callbackBaseUrl: 'http://localhost:3001/',
      });
      expect(p).toEqual({
        manualId: 'm1',
        assetId: 'a1',
        tenantId: 't1',
        name: 'Vrtačka',
        manufacturer: null,
        model: null,
        callbackUrl: 'http://localhost:3001/api/v1/manuals/webhook/callback',
      });
    });
    it('normalizuje koncová lomítka base URL', () => {
      const p = buildFetchPayload({
        manualId: 'm',
        assetId: 'a',
        tenantId: 't',
        name: 'n',
        manufacturer: 'Bosch',
        model: 'GSB',
        callbackBaseUrl: 'https://api.tagery.tech///',
      });
      expect(p.callbackUrl).toBe('https://api.tagery.tech/api/v1/manuals/webhook/callback');
      expect(p.manufacturer).toBe('Bosch');
      expect(p.model).toBe('GSB');
    });
  });

  describe('sign/verify', () => {
    it('podpis se ověří proti stejnému secretu', () => {
      const body = JSON.stringify({ manualId: 'm1' });
      const sig = signManualPayload(body, 'topsecret');
      expect(verifyManualSignature(body, sig, 'topsecret')).toBe(true);
    });
    it('selže na jiném secretu', () => {
      const body = JSON.stringify({ manualId: 'm1' });
      const sig = signManualPayload(body, 'topsecret');
      expect(verifyManualSignature(body, sig, 'other')).toBe(false);
    });
    it('selže na pozměněném těle', () => {
      const sig = signManualPayload('{"a":1}', 's');
      expect(verifyManualSignature('{"a":2}', sig, 's')).toBe(false);
    });
    it('selže na prázdném podpisu', () => {
      expect(verifyManualSignature('{"a":1}', '', 's')).toBe(false);
    });
  });
});
