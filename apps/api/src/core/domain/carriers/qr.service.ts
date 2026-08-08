import { Injectable } from '@nestjs/common';
import * as QRCode from 'qrcode';

/** Generuje QR obrázek z dat (obvykle resolver URL nosiče). */
@Injectable()
export class QrService {
  svg(data: string): Promise<string> {
    return QRCode.toString(data, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
  }

  png(data: string): Promise<Buffer> {
    return QRCode.toBuffer(data, { type: 'png', width: 512, margin: 1, errorCorrectionLevel: 'M' });
  }
}
