import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';
import sharp from 'sharp';
import {
  QR_ECC_PLAIN,
  QR_ECC_WITH_LOGO,
  qrLogoBox,
  qrLogoHole,
  inQrLogoHole,
} from '@tagery/shared';
import { TenantService, type TenantLogo } from '../tenant/tenant.service';

/**
 * QR identifikátorů s logem aktuální firmy uprostřed (pokud ho má). Oddělené od
 * `QrService`, který zůstává prostý (platební QR nesmí nést branding firmy).
 */
@Injectable()
export class BrandedQrService {
  constructor(private readonly tenant: TenantService) {}

  /** SVG (bez pevných rozměrů – škáluje se viewBoxem). */
  async brandedSvg(data: string, margin = 1): Promise<string> {
    return buildQrSvg(data, await this.tenant.logo(), margin);
  }

  /** PNG s celočíselnou velikostí modulu (≥ `width` px) – ostré, stejně široké moduly. */
  async brandedPng(data: string, width = 512, margin = 1): Promise<Buffer> {
    const svg = buildQrSvg(data, await this.tenant.logo(), margin, width);
    return sharp(Buffer.from(svg)).png().toBuffer();
  }
}


/**
 * QR jako SVG: moduly jako jedna cesta (řádkové běhy), bílé pozadí a – je-li
 * logo – vyčištěný otvor uprostřed s vloženým PNG (data URI). S logem se
 * použije korekce „H“, aby zakrytá plocha neovlivnila čtení.
 */
export function buildQrSvg(
  data: string,
  logo: TenantLogo | null,
  margin = 1,
  /** Pro rastrování: min. šířka v px (zaokrouhlí se na celé moduly). */
  minPx?: number,
): string {
  const qr = QRCode.create(data, {
    errorCorrectionLevel: logo ? QR_ECC_WITH_LOGO : QR_ECC_PLAIN,
  });
  const n = qr.modules.size;
  const bits = qr.modules.data;
  const hole = logo ? qrLogoHole(n, logo.aspect) : null;
  const size = n + 2 * margin;

  let path = '';
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (!bits[r * n + c] || inQrLogoHole(hole, r, c)) {
        c++;
        continue;
      }
      const start = c;
      while (c < n && bits[r * n + c] && !inQrLogoHole(hole, r, c)) c++;
      path += `M${start + margin} ${r + margin}h${c - start}v1h-${c - start}z`;
    }
  }

  const dims = minPx
    ? (() => {
        const px = size * Math.ceil(minPx / size);
        return ` width="${px}" height="${px}"`;
      })()
    : '';

  let image = '';
  if (logo && hole) {
    const box = qrLogoBox(hole, logo.aspect);
    image =
      `<image x="${box.x + margin}" y="${box.y + margin}" width="${box.w}" height="${box.h}" ` +
      `preserveAspectRatio="xMidYMid meet" ` +
      `href="data:image/png;base64,${logo.buffer.toString('base64')}"/>`;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg"${dims} viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">` +
    `<rect width="${size}" height="${size}" fill="#ffffff"/>` +
    `<path d="${path}" fill="#000000"/>` +
    image +
    `</svg>`
  );
}
