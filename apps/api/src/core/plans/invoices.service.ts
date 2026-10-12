import { existsSync } from 'node:fs';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';
import PDFDocument from 'pdfkit';
import * as QRCode from 'qrcode';
import { buildSpayd } from '../../modules/marketplace/payment/spayd';
import { SubscriptionService, type BillingDetails } from './subscription.service';
import { addDays, invoiceAmounts, nextInvoiceNumber, pragueToday } from './plans.logic';

export interface PlatformInvoice {
  id: string;
  tenantId: string;
  number: string;
  variableSymbol: string;
  issuedOn: string;
  taxableOn: string;
  dueOn: string;
  periodFrom: string | null;
  periodTo: string | null;
  planKey: string | null;
  description: string;
  amountNet: number;
  vatRate: number | null;
  amountVat: number;
  amountGross: number;
  currency: string;
  status: 'issued' | 'paid' | 'canceled';
  paidOn: string | null;
  supplier: Record<string, string>;
  customer: BillingDetails;
  createdAt: string;
}

export interface CreateInvoiceInput {
  description?: string;
  amountNet?: number;
  periodFrom?: string | null;
  periodTo?: string | null;
  issuedOn?: string;
  dueOn?: string;
}

const COLUMNS = `id, tenant_id, number, variable_symbol, to_char(issued_on,'YYYY-MM-DD') AS issued_on,
  to_char(taxable_on,'YYYY-MM-DD') AS taxable_on, to_char(due_on,'YYYY-MM-DD') AS due_on,
  to_char(period_from,'YYYY-MM-DD') AS period_from, to_char(period_to,'YYYY-MM-DD') AS period_to,
  plan_key, description, amount_net, vat_rate, amount_vat, amount_gross, currency, status,
  to_char(paid_on,'YYYY-MM-DD') AS paid_on, supplier, customer, created_at`;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** TTF s českou diakritikou (Alpine `font-dejavu`, Debian `fonts-dejavu-core`). */
const FONT_CANDIDATES = [
  ['/usr/share/fonts/dejavu/DejaVuSans.ttf', '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf'],
  [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  ],
];

function map(r: Record<string, unknown>): PlatformInvoice {
  const num = (v: unknown) => (v == null ? null : Number(v));
  return {
    id: String(r.id),
    tenantId: String(r.tenant_id),
    number: String(r.number),
    variableSymbol: String(r.variable_symbol),
    issuedOn: String(r.issued_on),
    taxableOn: String(r.taxable_on),
    dueOn: String(r.due_on),
    periodFrom: (r.period_from as string | null) ?? null,
    periodTo: (r.period_to as string | null) ?? null,
    planKey: (r.plan_key as string | null) ?? null,
    description: String(r.description),
    amountNet: Number(r.amount_net),
    vatRate: num(r.vat_rate),
    amountVat: Number(r.amount_vat),
    amountGross: Number(r.amount_gross),
    currency: String(r.currency),
    status: r.status as PlatformInvoice['status'],
    paidOn: (r.paid_on as string | null) ?? null,
    supplier: (r.supplier as Record<string, string>) ?? {},
    customer: (r.customer as BillingDetails) ?? {},
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  };
}

function fmtDay(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d}. ${m}. ${y}`;
}

function fmtMoney(n: number, currency: string): string {
  return new Intl.NumberFormat('cs-CZ', { style: 'currency', currency }).format(n);
}

/**
 * Faktury za předplatné (EPIC-20 F3, ruční platby): číselná řada po rocích,
 * VS = číslo faktury, PDF s QR platbou (SPAYD). Zaplacení prodlouží předplatné
 * do konce fakturovaného období.
 */
@Injectable()
export class InvoicesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly subscriptions: SubscriptionService,
  ) {}

  async list(tenantId: string): Promise<PlatformInvoice[]> {
    const rows = await this.dataSource.query(
      `SELECT ${COLUMNS} FROM platform_invoices WHERE tenant_id = $1 ORDER BY issued_on DESC, number DESC`,
      [tenantId],
    );
    return (rows as Record<string, unknown>[]).map(map);
  }

  async get(id: string, tenantId?: string): Promise<PlatformInvoice> {
    const rows = await this.dataSource.query(
      `SELECT ${COLUMNS} FROM platform_invoices WHERE id = $1 ${tenantId ? 'AND tenant_id = $2' : ''}`,
      tenantId ? [id, tenantId] : [id],
    );
    if (!rows.length) throw new NotFoundException('Faktura neexistuje');
    return map(rows[0]);
  }

  /** Návrh faktury za další období (předvyplnění formuláře). */
  async draft(tenantId: string): Promise<Required<CreateInvoiceInput>> {
    const sub = await this.subscriptions.get(tenantId);
    const plan = await this.subscriptions.plan(sub.planKey);
    const { from, to } = this.subscriptions.nextPeriod(sub);
    const today = pragueToday();
    const settings = await this.subscriptions.settings();
    return {
      description: `Předplatné Tagery – ${plan.name} (${fmtDay(from)} – ${fmtDay(to)})`,
      amountNet:
        sub.priceAmount ?? (sub.billingPeriod === 'year' ? plan.priceYear : plan.priceMonth) ?? 0,
      periodFrom: from,
      periodTo: to,
      issuedOn: today,
      dueOn: addDays(today, settings.invoiceDueDays),
    };
  }

  async create(
    tenantId: string,
    input: CreateInvoiceInput,
    actorUserId: string | null,
  ): Promise<PlatformInvoice> {
    const d = await this.draft(tenantId);
    const v = {
      ...d,
      ...Object.fromEntries(Object.entries(input).filter(([, x]) => x !== undefined)),
    };
    for (const day of [v.issuedOn, v.dueOn, v.periodFrom, v.periodTo]) {
      if (day && !DATE_RE.test(day)) throw new BadRequestException('Datum musí být RRRR-MM-DD');
    }
    if (!Number.isFinite(v.amountNet) || v.amountNet < 0)
      throw new BadRequestException('Neplatná částka');
    if (v.periodFrom && v.periodTo && v.periodTo < v.periodFrom)
      throw new BadRequestException('Konec období je před začátkem');
    const description = String(v.description ?? '').trim();
    if (!description) throw new BadRequestException('Chybí popis');

    const settings = await this.subscriptions.settings();
    if (!settings.supplier.iban)
      throw new BadRequestException('Doplň IBAN dodavatele v nastavení platformy (QR platba).');
    const sub = await this.subscriptions.get(tenantId);
    const tenant = (
      await this.dataSource.query(`SELECT name FROM tenants WHERE id = $1`, [tenantId])
    )[0] as { name: string } | undefined;
    const customer: BillingDetails = { name: tenant?.name, ...sub.billingDetails };
    const amounts = invoiceAmounts(v.amountNet, {
      payer: settings.vatPayer,
      rate: settings.vatRate,
    });
    const year = Number(v.issuedOn.slice(0, 4));

    // Číslo v transakci se zámkem řady, ať dvě faktury nedostanou stejné číslo.
    return this.dataSource.transaction(async (m) => {
      await m.query(`SELECT pg_advisory_xact_lock(hashtext('platform_invoice_number'))`);
      const existing = (
        (await m.query(`SELECT number FROM platform_invoices WHERE number LIKE $1`, [
          `${year}%`,
        ])) as { number: string }[]
      ).map((r) => r.number);
      const number = nextInvoiceNumber(year, existing);
      const rows = await m.query(
        `INSERT INTO platform_invoices (tenant_id, number, variable_symbol, issued_on, taxable_on, due_on,
           period_from, period_to, plan_key, description, amount_net, vat_rate, amount_vat, amount_gross,
           currency, supplier, customer, created_by)
         VALUES ($1,$2,$2,$3,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
        [
          tenantId,
          number,
          v.issuedOn,
          v.dueOn,
          v.periodFrom || null,
          v.periodTo || null,
          sub.planKey,
          description,
          amounts.amountNet,
          amounts.vatRate,
          amounts.amountVat,
          amounts.amountGross,
          sub.currency,
          JSON.stringify(settings.supplier),
          JSON.stringify(customer),
          actorUserId,
        ],
      );
      await m.query(
        `INSERT INTO tenant_subscription_events (tenant_id, type, data, actor_user_id) VALUES ($1,'invoice_issued',$2,$3)`,
        [tenantId, JSON.stringify({ number, amountGross: amounts.amountGross }), actorUserId],
      );
      const created = await m.query(`SELECT ${COLUMNS} FROM platform_invoices WHERE id = $1`, [
        rows[0].id,
      ]);
      return map(created[0]);
    });
  }

  /** Zaplaceno: stav + prodloužení předplatného do konce fakturovaného období. */
  async markPaid(
    id: string,
    paidOn: string | undefined,
    extend: boolean,
    actorUserId: string | null,
  ): Promise<PlatformInvoice> {
    const inv = await this.get(id);
    if (inv.status === 'canceled') throw new BadRequestException('Faktura je stornovaná');
    const day = paidOn ?? pragueToday();
    if (!DATE_RE.test(day)) throw new BadRequestException('Datum musí být RRRR-MM-DD');
    await this.dataSource.query(
      `UPDATE platform_invoices SET status='paid', paid_on=$2, updated_at=now() WHERE id=$1`,
      [id, day],
    );
    if (extend && inv.periodTo)
      await this.subscriptions.markPaidUntil(
        inv.tenantId,
        inv.periodFrom,
        inv.periodTo,
        actorUserId,
        {
          invoice: inv.number,
        },
      );
    else
      await this.subscriptions.event(
        inv.tenantId,
        'invoice_paid',
        { number: inv.number },
        actorUserId,
      );
    return this.get(id);
  }

  async cancel(id: string, actorUserId: string | null): Promise<PlatformInvoice> {
    const inv = await this.get(id);
    if (inv.status === 'paid') throw new BadRequestException('Zaplacenou fakturu nelze stornovat');
    await this.dataSource.query(
      `UPDATE platform_invoices SET status='canceled', updated_at=now() WHERE id=$1`,
      [id],
    );
    await this.subscriptions.event(
      inv.tenantId,
      'invoice_canceled',
      { number: inv.number },
      actorUserId,
    );
    return this.get(id);
  }

  /** PDF faktury s QR platbou. */
  async pdf(inv: PlatformInvoice): Promise<Buffer> {
    const fonts = FONT_CANDIDATES.find(([r, b]) => existsSync(r) && existsSync(b));
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: { Title: `Faktura ${inv.number}` },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) =>
      doc.on('end', () => resolve(Buffer.concat(chunks))),
    );
    if (fonts) {
      doc.registerFont('regular', fonts[0]);
      doc.registerFont('bold', fonts[1]);
    }
    const regular = fonts ? 'regular' : 'Helvetica';
    const bold = fonts ? 'bold' : 'Helvetica-Bold';
    const s = inv.supplier;
    const c = inv.customer;

    doc.font(bold).fontSize(20).text(`Faktura ${inv.number}`, 50, 50);
    doc
      .font(regular)
      .fontSize(10)
      .fillColor('#555')
      .text(inv.vatRate != null ? 'Daňový doklad' : 'Nejsme plátci DPH', 50, 76);

    const party = (title: string, x: number, lines: (string | undefined)[]) => {
      doc.fillColor('#888').font(bold).fontSize(9).text(title.toUpperCase(), x, 115);
      doc.fillColor('#111').font(regular).fontSize(10);
      let y = 130;
      for (const line of lines.filter(Boolean) as string[]) {
        doc.text(line, x, y, { width: 230 });
        y = doc.y + 2;
      }
    };
    party('Dodavatel', 50, [
      s.name,
      s.address,
      s.ico && `IČO: ${s.ico}`,
      s.dic && `DIČ: ${s.dic}`,
      s.email,
    ]);
    party('Odběratel', 310, [
      c.name,
      c.address,
      c.ico && `IČO: ${c.ico}`,
      c.dic && `DIČ: ${c.dic}`,
      c.email,
    ]);

    const rows: [string, string][] = [
      ['Datum vystavení', fmtDay(inv.issuedOn)],
      ['Datum zdanitelného plnění', fmtDay(inv.taxableOn)],
      ['Datum splatnosti', fmtDay(inv.dueOn)],
      ['Variabilní symbol', inv.variableSymbol],
      ...(s.bankAccount ? ([['Bankovní účet', s.bankAccount]] as [string, string][]) : []),
      ['IBAN', s.iban],
    ];
    let y = 240;
    for (const [k, v] of rows) {
      doc.fillColor('#666').font(regular).fontSize(10).text(k, 50, y);
      doc
        .fillColor('#111')
        .font(bold)
        .text(v || '—', 210, y);
      y += 16;
    }

    y += 20;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#ddd').stroke();
    y += 8;
    doc.fillColor('#888').font(bold).fontSize(9);
    doc.text('POLOŽKA', 50, y);
    doc.text('BEZ DPH', 330, y, { width: 70, align: 'right' });
    doc.text('DPH', 400, y, { width: 60, align: 'right' });
    doc.text('CELKEM', 465, y, { width: 80, align: 'right' });
    y += 16;
    doc.fillColor('#111').font(regular).fontSize(10);
    doc.text(inv.description, 50, y, { width: 270 });
    const rowY = y;
    doc.text(fmtMoney(inv.amountNet, inv.currency), 330, rowY, { width: 70, align: 'right' });
    doc.text(inv.vatRate != null ? `${inv.vatRate} %` : '—', 400, rowY, {
      width: 60,
      align: 'right',
    });
    doc.text(fmtMoney(inv.amountGross, inv.currency), 465, rowY, { width: 80, align: 'right' });
    y = Math.max(doc.y, rowY + 14) + 10;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#ddd').stroke();
    y += 12;
    if (inv.vatRate != null) {
      doc.font(regular).text(`Základ: ${fmtMoney(inv.amountNet, inv.currency)}`, 300, y, {
        width: 245,
        align: 'right',
      });
      y += 14;
      doc.text(`DPH ${inv.vatRate} %: ${fmtMoney(inv.amountVat, inv.currency)}`, 300, y, {
        width: 245,
        align: 'right',
      });
      y += 16;
    }
    doc
      .font(bold)
      .fontSize(14)
      .text(`K úhradě: ${fmtMoney(inv.amountGross, inv.currency)}`, 250, y, {
        width: 295,
        align: 'right',
      });
    y += 40;

    if (inv.status !== 'canceled' && s.iban) {
      try {
        const spayd = buildSpayd({
          iban: s.iban,
          amount: inv.amountGross,
          currency: inv.currency,
          vs: inv.variableSymbol,
          message: `Tagery ${inv.number}`,
        });
        const png = await QRCode.toBuffer(spayd, { margin: 1, width: 300 });
        doc.image(png, 50, y, { width: 120 });
        doc
          .font(bold)
          .fontSize(10)
          .fillColor('#111')
          .text('QR platba', 185, y + 10);
        doc
          .font(regular)
          .fontSize(9)
          .fillColor('#555')
          .text('Naskenujte v mobilním bankovnictví.', 185, y + 26, { width: 200 });
      } catch {
        // Neplatný IBAN – faktura bez QR.
      }
    }
    if (inv.status === 'paid')
      doc
        .font(bold)
        .fontSize(12)
        .fillColor('#047857')
        .text(`Zaplaceno ${fmtDay(inv.paidOn)}`, 380, y + 10);
    if (inv.status === 'canceled')
      doc
        .font(bold)
        .fontSize(12)
        .fillColor('#b91c1c')
        .text('STORNOVÁNO', 380, y + 10);

    doc.end();
    return done;
  }
}
