import { BadRequestException } from '@nestjs/common';

/**
 * Ověření obsahu nahraného souboru podle magických bajtů (BACKLOG SEC-05).
 * MIME typ posílá klient, takže sám o sobě nic nezaručuje (např. HTML/SVG se skriptem
 * vydávané za obrázek). Kontrolujeme, že obsah odpovídá deklarované rodině typu.
 */
export type FileFamily = 'image' | 'video' | 'pdf';

const IMAGE_FTYP = new Set(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'mif1', 'msf1', 'avif', 'avis']);

function startsWith(buf: Buffer, bytes: number[], offset = 0): boolean {
  if (buf.length < offset + bytes.length) return false;
  return bytes.every((b, i) => buf[offset + i] === b);
}

/** Rozpozná rodinu souboru z obsahu; `null` = neznámý / nepodporovaný formát. */
export function detectFileFamily(buf: Buffer): FileFamily | null {
  if (!buf || buf.length < 4) return null;
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return 'image'; // JPEG
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image'; // PNG
  if (startsWith(buf, [0x47, 0x49, 0x46, 0x38])) return 'image'; // GIF8
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && buf.length >= 12) {
    const kind = buf.subarray(8, 12).toString('ascii');
    if (kind === 'WEBP') return 'image';
    if (kind === 'AVI ') return 'video';
  }
  if (startsWith(buf, [0x42, 0x4d])) return 'image'; // BMP
  if (startsWith(buf, [0x49, 0x49, 0x2a, 0x00]) || startsWith(buf, [0x4d, 0x4d, 0x00, 0x2a])) {
    return 'image'; // TIFF
  }
  if (buf.length >= 12 && buf.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buf.subarray(8, 12).toString('ascii').toLowerCase();
    return IMAGE_FTYP.has(brand) ? 'image' : 'video'; // HEIC/AVIF vs. MP4/MOV/3GP
  }
  if (startsWith(buf, [0x1a, 0x45, 0xdf, 0xa3])) return 'video'; // WebM / Matroska
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'pdf'; // %PDF-
  return null;
}

/** Rodina očekávaná podle deklarovaného MIME; SVG úmyslně nepodporujeme (skripty). */
export function familyForMime(mime: string): FileFamily | null {
  const m = (mime || '').toLowerCase().split(';')[0].trim();
  if (m === 'application/pdf') return 'pdf';
  if (m === 'image/svg+xml') return null;
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  return null;
}

/** Vyhodí 400, pokud obsah neodpovídá deklarovanému typu. */
export function assertFileContentMatches(buf: Buffer, mime: string): void {
  const expected = familyForMime(mime);
  if (!expected) throw new BadRequestException('Nepodporovaný typ souboru');
  const actual = detectFileFamily(buf);
  if (actual !== expected) {
    throw new BadRequestException('Obsah souboru neodpovídá jeho typu');
  }
}
