import { Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { TenantContextService } from '../tenancy/tenant-context.service';
import { DataCarrier } from '../domain/entities/data-carrier.entity';
import { BrandedQrService } from '../domain/carriers/branded-qr.service';
import { QR_CAPTION } from '@tagery/shared';
import { buildLabelSvg } from './label';

export interface FabricationOutput {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

/**
 * Export identifikátory do tiskových souborů (EPIC-02, větev A). Synchronní label
 * export: SVG (vektor), PNG, PDF. FabricationTemplate/Job + async je follow-up.
 */
@Injectable()
export class FabricationService {
  constructor(
    private readonly context: TenantContextService,
    private readonly qr: BrandedQrService,
  ) {}

  private async carrier(id: string): Promise<DataCarrier> {
    const carrier = await this.context.manager
      .getRepository(DataCarrier)
      .findOne({ where: { id } });
    if (!carrier) throw new NotFoundException('Identifikátor neexistuje');
    return carrier;
  }

  async label(id: string, format: 'svg' | 'png' | 'pdf'): Promise<FabricationOutput> {
    const carrier = await this.carrier(id);
    const data = carrier.resolverUrl ?? carrier.publicCode;

    if (format === 'svg') {
      const qr = await this.qr.brandedSvg(data, 0);
      const svg = buildLabelSvg(qr, carrier.publicCode);
      return {
        buffer: Buffer.from(svg, 'utf8'),
        contentType: 'image/svg+xml',
        filename: `label-${carrier.publicCode}.svg`,
      };
    }

    const qrPng = await this.qr.brandedPng(data, 512, 1);

    if (format === 'png') {
      return {
        buffer: qrPng,
        contentType: 'image/png',
        filename: `label-${carrier.publicCode}.png`,
      };
    }

    // PDF: QR (s logem) + „by tagery.tech" + kód na štítek.
    const pdf = await this.renderPdf(qrPng, carrier.publicCode);
    return {
      buffer: pdf,
      contentType: 'application/pdf',
      filename: `label-${carrier.publicCode}.pdf`,
    };
  }

  private renderPdf(qrPng: Buffer, code: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: [240, 300], margin: 20 });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.image(qrPng, 20, 20, { width: 200 });
      // QR PNG má 1 modul klidové zóny – text zarovnaný k levé hraně modulů.
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#111111').text(QR_CAPTION, 26, 224);
      doc.font('Courier').fontSize(16).text(code, 20, 250, { width: 200, align: 'center' });
      doc.end();
    });
  }
}
