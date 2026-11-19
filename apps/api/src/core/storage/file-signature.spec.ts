import { assertFileContentMatches, detectFileFamily, familyForMime } from './file-signature';

const hex = (h: string): Buffer => Buffer.from(h.replace(/\s+/g, ''), 'hex');
const ftyp = (brand: string): Buffer =>
  Buffer.concat([hex('00000018'), Buffer.from('ftyp' + brand, 'ascii'), Buffer.alloc(12)]);

describe('file-signature (SEC-05)', () => {
  it.each([
    ['jpeg', hex('ffd8ffe000104a464946'), 'image'],
    ['png', hex('89504e470d0a1a0a0000'), 'image'],
    ['gif', Buffer.from('GIF89a....'), 'image'],
    ['webp', Buffer.concat([Buffer.from('RIFF'), hex('00000000'), Buffer.from('WEBPVP8 ')]), 'image'],
    ['heic', ftyp('heic'), 'image'],
    ['mp4', ftyp('isom'), 'video'],
    ['mov', ftyp('qt  '), 'video'],
    ['webm', hex('1a45dfa39f4286810142'), 'video'],
    ['pdf', Buffer.from('%PDF-1.7\n'), 'pdf'],
  ])('rozpozná %s', (_name, buf, family) => {
    expect(detectFileFamily(buf as Buffer)).toBe(family);
  });

  it('neznámý obsah vrací null', () => {
    expect(detectFileFamily(Buffer.from('<html><script>alert(1)</script>'))).toBeNull();
    expect(detectFileFamily(Buffer.alloc(2))).toBeNull();
  });

  it('SVG a neznámé MIME nepodporuje', () => {
    expect(familyForMime('image/svg+xml')).toBeNull();
    expect(familyForMime('text/html')).toBeNull();
    expect(familyForMime('image/jpeg; charset=binary')).toBe('image');
  });

  it('propustí odpovídající soubor', () => {
    expect(() => assertFileContentMatches(hex('ffd8ffe0'), 'image/jpeg')).not.toThrow();
    expect(() => assertFileContentMatches(ftyp('heic'), 'image/heic')).not.toThrow();
    expect(() => assertFileContentMatches(Buffer.from('%PDF-1.4'), 'application/pdf')).not.toThrow();
  });

  it('odmítne HTML vydávané za obrázek, PDF za obrázek i SVG', () => {
    expect(() => assertFileContentMatches(Buffer.from('<html>x</html>'), 'image/png')).toThrow(
      'neodpovídá',
    );
    expect(() => assertFileContentMatches(Buffer.from('%PDF-1.4'), 'image/png')).toThrow();
    expect(() => assertFileContentMatches(Buffer.from('<svg/>'), 'image/svg+xml')).toThrow(
      'Nepodporovaný',
    );
  });
});
