import { BadRequestException, Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { Repository } from 'typeorm';
import { TenantContextService } from '../../core/tenancy/tenant-context.service';
import { AuthzService } from '../../core/rbac/authz.service';
import { AuditService } from '../../core/rbac/audit.service';
import type { RequestUser } from '../../core/auth/jwt-auth.guard';
import { Location } from '../../core/domain/entities/location.entity';
import { Person } from '../../core/domain/entities/person.entity';
import { Tenant } from '../../core/domain/entities/tenant.entity';
import { AssetService } from './asset.service';
import { Asset } from './entities/asset.entity';
import { Category } from './entities/category.entity';
import { AssetPurchase } from './entities/asset-purchase.entity';
import { AssetWarranty } from './entities/asset-warranty.entity';
import { toCsv } from './csv.logic';
import {
  ASSET_COLUMNS,
  CONDITION_LABELS,
  IMPORT_MAX_ROWS,
  STATUS_LABELS,
  formatCzDate,
  formatCzNumber,
  mapHeader,
  parseCondition,
  parseCsvFile,
  parseDate,
  parseNumber,
  resolveImportPrice,
  type ColumnDef,
  type ColumnKey,
} from './asset-io.logic';
import { PurchaseService } from './purchase.service';
import {
  defaultStartBasis,
  tenantIsVatPayer,
  tenantVatRate,
  warrantyStartFor,
  type PriceBreakdown,
  type PurchaseCondition,
  type PurchaseDates,
  type WarrantyStartBasis,
} from './purchase.logic';

export type TransferFormat = 'xlsx' | 'csv';

export interface TransferFile {
  buffer: Buffer;
  mime: string;
  fileName: string;
}

export type ImportAction = 'create' | 'update' | 'unchanged' | 'error';

export interface ImportRowView {
  row: number;
  action: ImportAction;
  name: string;
  inventoryNumber: string | null;
  changes: string[];
  error?: string;
}

export interface ImportResult {
  dryRun: boolean;
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
  warnings: string[];
  rows: ImportRowView[];
  truncated: boolean;
}

type Cell = string | number | null;
type ExportRow = Partial<Record<ColumnKey, Cell>>;

interface AssetPatch {
  name?: string;
  categoryName?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  inventoryNumber?: string;
  locationName?: string;
}

interface PurchasePatch {
  purchasedOn?: string;
  condition?: PurchaseCondition;
  inServiceOn?: string;
  supplier?: string;
  documentNumber?: string;
  price?: PriceBreakdown;
}

interface RowPlan extends ImportRowView {
  assetId?: string;
  asset: AssetPatch;
  purchase: PurchasePatch;
  warranty?: {
    op: 'create' | 'update';
    id?: string;
    endsOn: string;
    startsOn: string | null;
    startBasis?: WarrantyStartBasis;
  };
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const ROW_VIEW_LIMIT = 500;
const TEXT_LIMITS: Partial<Record<ColumnKey, number>> = { name: 300, category: 120 };
const ASSET_FIELDS: (keyof AssetPatch)[] = [
  'name',
  'categoryName',
  'manufacturer',
  'model',
  'serialNumber',
  'inventoryNumber',
  'locationName',
];
const LABEL = new Map(ASSET_COLUMNS.map((c) => [c.key, c.label]));

/** Ochrana před CSV injection: text začínající =,+,-,@ Excel nespustí jako vzorec. */
function csvSafe(v: string): string {
  return /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
}

/** Hodnota buňky Excelu → text (datum jako YYYY-MM-DD, vzorec → výsledek). */
function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'string') return v;
  if ('richText' in v) return v.richText.map((t) => t.text).join('');
  if ('result' in v) return cellText((v.result ?? null) as ExcelJS.CellValue);
  if ('text' in v) return String(v.text);
  return '';
}

/**
 * Hromadný export/import položek (Excel .xlsx i CSV). Import má náhled
 * (dry-run): nic nezapíše a vrátí, co se založí, upraví a co je chybné.
 * Sloupce pořízení čte/zapisuje jen oprávnění `asset.purchase.*`.
 */
@Injectable()
export class AssetIoService {
  constructor(
    private readonly context: TenantContextService,
    private readonly assets: AssetService,
    private readonly authz: AuthzService,
    private readonly audit: AuditService,
    private readonly purchases: PurchaseService,
  ) {}

  private repo<T extends object>(entity: { new (): T }): Repository<T> {
    return this.context.manager.getRepository(entity);
  }

  private async can(user: RequestUser, permission: string): Promise<boolean> {
    return (await this.authz.can(user, permission)).allowed;
  }

  private columns(includePurchase: boolean): ColumnDef[] {
    return ASSET_COLUMNS.filter((c) => includePurchase || !c.purchase);
  }

  private async vat() {
    const tenant = await this.repo(Tenant).findOne({ where: { id: this.context.tenantId } });
    return {
      payer: tenantIsVatPayer(tenant?.settings),
      defaultRate: tenantVatRate(tenant?.settings),
    };
  }

  // --- Export ---

  async export(user: RequestUser, format: TransferFormat): Promise<TransferFile> {
    const includePurchase = await this.can(user, 'asset.purchase.view');
    const cols = this.columns(includePurchase);
    const rows = await this.exportRows(includePurchase);
    const day = new Date().toISOString().slice(0, 10);
    return this.render(cols, rows, format, `polozky-${day}`, false);
  }

  private async exportRows(includePurchase: boolean): Promise<ExportRow[]> {
    // Sekvenčně – jeden query runner tenant transakce nesnese paralelní dotazy.
    const assets = await this.repo(Asset).find({ order: { createdAt: 'DESC' } });
    const locations = await this.repo(Location).find();
    const people = await this.repo(Person).find();
    const locName = new Map(locations.map((l) => [l.id, l.name]));
    const perName = new Map(people.map((p) => [p.id, p.name]));
    const purchases = new Map<string, AssetPurchase>();
    const warrantyEnd = new Map<string, string>();
    if (includePurchase) {
      for (const p of await this.repo(AssetPurchase).find()) purchases.set(p.assetId, p);
      for (const w of await this.repo(AssetWarranty).find()) {
        const cur = warrantyEnd.get(w.assetId);
        if (!cur || w.endsOn > cur) warrantyEnd.set(w.assetId, w.endsOn);
      }
    }
    return assets.map((a) => {
      const p = purchases.get(a.id);
      const holder =
        a.currentHolderType === 'person'
          ? perName.get(a.currentHolderId ?? '')
          : a.currentHolderType === 'location'
            ? locName.get(a.currentHolderId ?? '')
            : null;
      return {
        id: a.id,
        name: a.name,
        category: a.category,
        manufacturer: a.manufacturer,
        model: a.model,
        serialNumber: a.serialNumber,
        inventoryNumber: a.inventoryNumber,
        homeLocation: locName.get(a.homeLocationId ?? '') ?? null,
        status: STATUS_LABELS[a.status] ?? a.status,
        holder: holder ?? null,
        purchasedOn: p?.purchasedOn ?? null,
        condition: p ? CONDITION_LABELS[p.condition] : null,
        inServiceOn: p?.inServiceOn ?? null,
        supplier: p?.supplier ?? null,
        documentNumber: p?.documentNumber ?? null,
        priceNet: p?.priceNet ?? null,
        vatRate: p?.vatRate ?? null,
        priceGross: p?.priceGross ?? null,
        warrantyEndsOn: warrantyEnd.get(a.id) ?? null,
      };
    });
  }

  // --- Šablona ---

  async template(user: RequestUser, format: TransferFormat): Promise<TransferFile> {
    const includePurchase = await this.can(user, 'asset.purchase.update');
    const cols = this.columns(includePurchase).filter((c) => !c.exportOnly);
    const example: ExportRow = {};
    for (const c of cols) {
      if (!c.example) continue;
      example[c.key] =
        c.kind === 'money' || c.kind === 'percent'
          ? parseNumber(c.example)
          : c.kind === 'date'
            ? (parseDate(c.example) as string)
            : c.example;
    }
    return this.render(cols, [example], format, 'sablona-import-polozek', true);
  }

  private async render(
    cols: ColumnDef[],
    rows: ExportRow[],
    format: TransferFormat,
    baseName: string,
    withGuide: boolean,
  ): Promise<TransferFile> {
    if (format === 'csv') {
      const text = (c: ColumnDef, v: Cell): string => {
        if (v == null) return '';
        if (c.kind === 'date') return formatCzDate(String(v));
        if (c.kind === 'money' || c.kind === 'percent') return formatCzNumber(Number(v));
        return csvSafe(String(v));
      };
      const csv = toCsv(
        [cols.map((c) => c.label), ...rows.map((r) => cols.map((c) => text(c, r[c.key] ?? null)))],
        ';',
        '\r\n',
      );
      return {
        buffer: Buffer.from(`\uFEFF${csv}\r\n`, 'utf8'),
        mime: 'text/csv; charset=utf-8',
        fileName: `${baseName}.csv`,
      };
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Tagery';
    const ws = wb.addWorksheet('Položky', { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = cols.map((c) => ({ header: c.label, key: c.key, width: c.width }));
    for (const r of rows) {
      ws.addRow(
        cols.map((c) => {
          const v = r[c.key] ?? null;
          if (v == null || v === '') return null;
          if (c.kind === 'date') {
            const [y, m, d] = String(v).split('-').map(Number);
            return new Date(Date.UTC(y, m - 1, d));
          }
          if (c.kind === 'money' || c.kind === 'percent') return Number(v);
          return String(v);
        }),
      );
    }
    cols.forEach((c, i) => {
      const col = ws.getColumn(i + 1);
      if (c.kind === 'date') col.numFmt = 'd.m.yyyy';
      if (c.kind === 'money') col.numFmt = '#,##0.00';
      if (c.kind === 'text') col.numFmt = '@';
      const head = ws.getCell(1, i + 1);
      head.font = { bold: true, color: { argb: c.exportOnly ? 'FF64748B' : 'FF0F172A' } };
      head.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: c.exportOnly ? 'FFF1F5F9' : c.purchase ? 'FFECFDF5' : 'FFEEF2FF' },
      };
      if (c.help) head.note = c.help;
    });
    const condIdx = cols.findIndex((c) => c.key === 'condition');
    if (condIdx >= 0) {
      // Rozbalovací výběr nové/použité (exceljs typy dataValidations neznají).
      const letter = ws.getColumn(condIdx + 1).letter;
      (
        ws as unknown as {
          dataValidations: { add(range: string, v: Record<string, unknown>): void };
        }
      ).dataValidations.add(`${letter}2:${letter}${IMPORT_MAX_ROWS + 1}`, {
        type: 'list',
        allowBlank: true,
        formulae: [`"${CONDITION_LABELS.new},${CONDITION_LABELS.used}"`],
      });
    }
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };

    if (withGuide) {
      const guide = wb.addWorksheet('Návod');
      guide.columns = [
        { header: 'Sloupec', key: 'label', width: 20 },
        { header: 'Povinné', key: 'req', width: 10 },
        { header: 'Popis', key: 'help', width: 90 },
      ];
      guide.getRow(1).font = { bold: true };
      for (const c of cols) {
        guide.addRow({ label: c.label, req: c.key === 'name' ? 'u nové' : '', help: c.help });
      }
      guide.addRow({});
      for (const line of [
        'Vyplňuj list „Položky" – první řádek (hlavičku) neměň, ukázkový řádek přepiš nebo smaž.',
        'Řádek s ID nebo existujícím inventárním číslem upraví položku, ostatní se založí jako nové.',
        'Prázdná buňka u úpravy znamená „beze změny" – import nic nemaže.',
        'Před uložením uvidíš náhled: kolik položek se založí, upraví a které řádky jsou chybné.',
      ]) {
        guide.addRow({ help: line });
      }
    }

    return {
      buffer: Buffer.from(await wb.xlsx.writeBuffer()),
      mime: XLSX_MIME,
      fileName: `${baseName}.xlsx`,
    };
  }

  // --- Import ---

  /** Načte tabulku ze souboru (.xlsx nebo CSV) jako pole řádků textu. */
  async readTable(buf: Buffer): Promise<string[][]> {
    if (buf.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))) {
      const wb = new ExcelJS.Workbook();
      try {
        await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
      } catch {
        throw new BadRequestException('Soubor .xlsx se nepodařilo přečíst');
      }
      const ws = wb.getWorksheet('Položky') ?? wb.worksheets[0];
      if (!ws) return [];
      const rows: string[][] = [];
      const width = ws.columnCount;
      for (let r = 1; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const cells: string[] = [];
        for (let c = 1; c <= width; c++) cells.push(cellText(row.getCell(c).value).trim());
        if (cells.some((x) => x !== '')) rows.push(cells);
      }
      return rows;
    }
    if (buf.subarray(0, 4).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0]))) {
      throw new BadRequestException('Starý formát .xls – ulož soubor jako .xlsx nebo CSV');
    }
    return parseCsvFile(buf);
  }

  async import(
    user: RequestUser,
    buf: Buffer,
    dryRun: boolean,
    fileName?: string,
  ): Promise<ImportResult> {
    const table = await this.readTable(buf);
    if (table.length < 2)
      throw new BadRequestException('Soubor neobsahuje žádné řádky s položkami');
    if (table.length - 1 > IMPORT_MAX_ROWS)
      throw new BadRequestException(`Import může obsahovat nejvýše ${IMPORT_MAX_ROWS} řádků`);

    const header = mapHeader(table[0]);
    if (
      header.index.name === undefined &&
      header.index.id === undefined &&
      header.index.inventoryNumber === undefined
    ) {
      throw new BadRequestException(
        'Nepoznám hlavičku – první řádek musí obsahovat názvy sloupců (např. Název, Inventární číslo). Stáhni si šablonu.',
      );
    }
    const warnings: string[] = [];
    if (header.unknown.length)
      warnings.push(`Neznámé sloupce se ignorují: ${header.unknown.join(', ')}`);
    if (header.duplicate.length)
      warnings.push(`Duplicitní sloupce (použit první): ${header.duplicate.join(', ')}`);
    const ignoredExport = ASSET_COLUMNS.filter(
      (c) => c.exportOnly && header.index[c.key] !== undefined,
    );
    if (ignoredExport.length)
      warnings.push(
        `Sloupce jen pro čtení se při importu nemění: ${ignoredExport.map((c) => c.label).join(', ')}`,
      );

    const canUpdate = await this.can(user, 'asset.item.update');
    let usePurchase = ASSET_COLUMNS.some((c) => c.purchase && header.index[c.key] !== undefined);
    if (usePurchase && !(await this.can(user, 'asset.purchase.update'))) {
      usePurchase = false;
      warnings.push(
        'Sloupce pořízení (ceny, záruka) se ignorují – nemáš oprávnění „Pořízení, ceny a záruky → Upravovat".',
      );
    }

    const plans = await this.plan(table, header.index, { canUpdate, usePurchase }, warnings);
    if (!dryRun) await this.apply(plans);

    const count = (a: ImportAction) => plans.filter((p) => p.action === a).length;
    const result: ImportResult = {
      dryRun,
      total: plans.length,
      created: count('create'),
      updated: count('update'),
      unchanged: count('unchanged'),
      failed: count('error'),
      warnings,
      rows: [],
      truncated: false,
    };
    const visible = plans.filter((p) => p.action !== 'unchanged');
    result.truncated = visible.length > ROW_VIEW_LIMIT;
    result.rows = [
      ...visible.filter((p) => p.action === 'error'),
      ...visible.filter((p) => p.action !== 'error'),
    ]
      .slice(0, ROW_VIEW_LIMIT)
      .sort((a, b) => a.row - b.row)
      .map(({ row, action, name, inventoryNumber, changes, error }) => ({
        row,
        action,
        name,
        inventoryNumber,
        changes,
        ...(error ? { error } : {}),
      }));

    if (!dryRun) {
      await this.audit.record({
        action: 'asset.import',
        targetType: 'asset',
        after: {
          fileName: fileName ?? null,
          created: result.created,
          updated: result.updated,
          failed: result.failed,
        },
      });
    }
    return result;
  }

  private async plan(
    table: string[][],
    index: Partial<Record<ColumnKey, number>>,
    opts: { canUpdate: boolean; usePurchase: boolean },
    warnings: string[],
  ): Promise<RowPlan[]> {
    const assets = await this.repo(Asset).find();
    const locations = await this.repo(Location).find();
    const vat = await this.vat();
    const purchases = new Map<string, AssetPurchase>();
    const warranties = new Map<string, AssetWarranty[]>();
    if (opts.usePurchase) {
      for (const p of await this.repo(AssetPurchase).find()) purchases.set(p.assetId, p);
      for (const w of await this.repo(AssetWarranty).find()) {
        warranties.set(w.assetId, [...(warranties.get(w.assetId) ?? []), w]);
      }
    }
    const byId = new Map(assets.map((a) => [a.id, a]));
    const byInv = new Map(
      assets
        .filter((a) => a.inventoryNumber?.trim())
        .map((a) => [a.inventoryNumber!.trim().toLowerCase(), a]),
    );
    const locName = new Map(locations.map((l) => [l.id, l.name]));
    const seenAsset = new Map<string, number>();
    const seenInv = new Map<string, number>();

    const plans: RowPlan[] = [];
    for (let i = 1; i < table.length; i++) {
      const cells = table[i];
      const rowNo = i + 1;
      const get = (key: ColumnKey): string | undefined => {
        const idx = index[key];
        if (idx === undefined) return undefined;
        const raw = (cells[idx] ?? '').trim();
        return raw.replace(/^'(?=[=+\-@])/, '');
      };
      const errors: string[] = [];
      const text = (key: ColumnKey): string | undefined => {
        const v = get(key);
        if (!v) return undefined;
        const limit = TEXT_LIMITS[key] ?? 200;
        if (v.length > limit) errors.push(`${LABEL.get(key)}: max. ${limit} znaků`);
        return v;
      };

      const id = get('id');
      const inv = text('inventoryNumber');
      const invKey = inv?.toLowerCase();
      let target: Asset | undefined;
      if (id) {
        target = byId.get(id);
        if (!target) errors.push('ID nepatří žádné položce této firmy (smazaná nebo z jiné firmy)');
      } else if (invKey) {
        target = byInv.get(invKey);
      }
      if (target && seenAsset.has(target.id)) {
        errors.push(`Položka je v souboru už na řádku ${seenAsset.get(target.id)}`);
      }
      if (invKey) {
        const owner = byInv.get(invKey);
        if (owner && target && owner.id !== target.id) {
          errors.push(`Inventární číslo ${inv} už má jiná položka („${owner.name}")`);
        } else if (seenInv.has(invKey) && seenInv.get(invKey) !== rowNo) {
          errors.push(
            `Inventární číslo ${inv} je v souboru dvakrát (řádek ${seenInv.get(invKey)})`,
          );
        }
      }

      const plan: RowPlan = {
        row: rowNo,
        action: target ? 'update' : 'create',
        name: get('name') || target?.name || '',
        inventoryNumber: inv ?? target?.inventoryNumber ?? null,
        changes: [],
        assetId: target?.id,
        asset: {},
        purchase: {},
      };
      const values: AssetPatch = {
        name: text('name'),
        categoryName: text('category'),
        manufacturer: text('manufacturer'),
        model: text('model'),
        serialNumber: text('serialNumber'),
        inventoryNumber: inv,
        locationName: text('homeLocation'),
      };
      if (!target && !values.name && !errors.length) errors.push('Chybí název nové položky');

      // Pořízení
      let purchasedOn: string | null | undefined;
      let price: PriceBreakdown | null = null;
      let warrantyEnd: string | null = null;
      const existingPurchase = target ? purchases.get(target.id) : undefined;
      if (opts.usePurchase) {
        const date = (key: ColumnKey): string | null => {
          const v = parseDate(get(key) ?? '');
          if (v === 'invalid') {
            errors.push(`${LABEL.get(key)}: neplatné datum „${get(key)}" (použij 1.3.2026)`);
            return null;
          }
          return v;
        };
        const num = (key: ColumnKey, max: number): number | null => {
          const v = parseNumber(get(key) ?? '');
          if (v != null && (Number.isNaN(v) || v < 0 || v > max)) {
            errors.push(`${LABEL.get(key)}: neplatné číslo „${get(key)}"`);
            return null;
          }
          return v;
        };
        purchasedOn = date('purchasedOn');
        const inServiceOn = date('inServiceOn');
        const conditionRaw = get('condition') ?? '';
        const condition = parseCondition(conditionRaw);
        if (condition === 'invalid')
          errors.push(
            `${LABEL.get('condition')}: „${conditionRaw}" (použij „nové" nebo „použité")`,
          );
        warrantyEnd = date('warrantyEndsOn');
        price = resolveImportPrice(
          {
            net: num('priceNet', 999_999_999_999),
            gross: num('priceGross', 999_999_999_999),
            rate: num('vatRate', 100),
          },
          existingPurchase ?? null,
          vat,
        );
        const supplier = text('supplier');
        const documentNumber = text('documentNumber');
        const ex = existingPurchase;
        if (purchasedOn && purchasedOn !== ex?.purchasedOn) plan.purchase.purchasedOn = purchasedOn;
        if (condition && condition !== 'invalid' && condition !== (ex?.condition ?? 'new'))
          plan.purchase.condition = condition;
        if (inServiceOn && inServiceOn !== ex?.inServiceOn) plan.purchase.inServiceOn = inServiceOn;
        if (supplier && supplier !== ex?.supplier) plan.purchase.supplier = supplier;
        if (documentNumber && documentNumber !== ex?.documentNumber)
          plan.purchase.documentNumber = documentNumber;
        if (
          price &&
          (price.priceNet !== (ex?.priceNet ?? null) ||
            price.priceGross !== (ex?.priceGross ?? null) ||
            price.vatRate !== (ex?.vatRate ?? null))
        ) {
          plan.purchase.price = price;
        }
        if (warrantyEnd) {
          const list = target ? (warranties.get(target.id) ?? []) : [];
          // Data pořízení po importu řádku → začátek nové záruky.
          const dates: PurchaseDates = {
            condition: plan.purchase.condition ?? ex?.condition ?? 'new',
            purchasedOn: purchasedOn ?? ex?.purchasedOn ?? null,
            inServiceOn: inServiceOn ?? ex?.inServiceOn ?? null,
          };
          const startBasis = defaultStartBasis(dates);
          const startsOn = warrantyStartFor(startBasis, dates);
          if (startsOn && warrantyEnd < startsOn) {
            errors.push(
              startBasis === 'in_service'
                ? 'Konec záruky je před uvedením do provozu'
                : 'Konec záruky je před datem pořízení',
            );
          } else if (list.length === 0) {
            plan.warranty = { op: 'create', endsOn: warrantyEnd, startsOn, startBasis };
          } else if (list.length === 1) {
            if (list[0].endsOn !== warrantyEnd)
              plan.warranty = {
                op: 'update',
                id: list[0].id,
                endsOn: warrantyEnd,
                startsOn: list[0].startsOn,
              };
          } else if (!list.some((w) => w.endsOn === warrantyEnd)) {
            warnings.push(
              `Řádek ${rowNo}: položka má víc záruk – konec záruky uprav v detailu položky.`,
            );
          }
        }
      }

      if (errors.length) {
        plan.action = 'error';
        plan.error = errors.join('; ');
        plans.push(plan);
        continue;
      }

      if (target) {
        const current: Record<keyof AssetPatch, string> = {
          name: target.name,
          categoryName: target.category ?? '',
          manufacturer: target.manufacturer ?? '',
          model: target.model ?? '',
          serialNumber: target.serialNumber ?? '',
          inventoryNumber: target.inventoryNumber ?? '',
          locationName: locName.get(target.homeLocationId ?? '') ?? '',
        };
        for (const f of ASSET_FIELDS) {
          const v = values[f];
          if (v === undefined) continue;
          const same =
            f === 'categoryName' || f === 'locationName'
              ? v.toLowerCase() === current[f].toLowerCase()
              : v === current[f];
          if (!same) plan.asset[f] = v;
        }
        seenAsset.set(target.id, rowNo);
      } else {
        for (const f of ASSET_FIELDS) if (values[f] !== undefined) plan.asset[f] = values[f];
      }
      if (invKey) seenInv.set(invKey, rowNo);

      plan.changes = [
        ...Object.keys(plan.asset).map((k) =>
          LABEL.get(
            (
              { categoryName: 'category', locationName: 'homeLocation' } as Record<
                string,
                ColumnKey
              >
            )[k] ?? (k as ColumnKey),
          )!,
        ),
        ...(plan.purchase.purchasedOn ? [LABEL.get('purchasedOn')!] : []),
        ...(plan.purchase.condition ? [LABEL.get('condition')!] : []),
        ...(plan.purchase.inServiceOn ? [LABEL.get('inServiceOn')!] : []),
        ...(plan.purchase.supplier ? [LABEL.get('supplier')!] : []),
        ...(plan.purchase.documentNumber ? [LABEL.get('documentNumber')!] : []),
        ...(plan.purchase.price ? ['Cena'] : []),
        ...(plan.warranty ? [LABEL.get('warrantyEndsOn')!] : []),
      ];

      if (target) {
        if (plan.changes.length === 0) plan.action = 'unchanged';
        else if (Object.keys(plan.asset).length && !opts.canUpdate) {
          plan.action = 'error';
          plan.error = 'Nemáš oprávnění upravovat položky (jen zakládat nové)';
        }
      }
      plans.push(plan);
    }
    return plans;
  }

  private async apply(plans: RowPlan[]): Promise<void> {
    const manager = this.context.manager;
    const catRepo = this.repo(Category);
    const locRepo = this.repo(Location);
    const catByName = new Map((await catRepo.find()).map((c) => [c.name.toLowerCase(), c]));
    const locByName = new Map((await locRepo.find()).map((l) => [l.name.toLowerCase(), l]));
    const vatPayer = (await this.vat()).payer;
    const tenantId = this.context.tenantId!;

    const categoryId = async (name: string): Promise<string> => {
      let cat = catByName.get(name.toLowerCase());
      if (!cat) {
        cat = await catRepo.save(catRepo.create({ tenantId, name, color: null }));
        catByName.set(name.toLowerCase(), cat);
      }
      return cat.id;
    };
    const locationId = async (name: string): Promise<string> => {
      let loc = locByName.get(name.toLowerCase());
      if (!loc) {
        loc = await locRepo.save(locRepo.create({ tenantId, name }));
        locByName.set(name.toLowerCase(), loc);
      }
      return loc.id;
    };

    for (const plan of plans) {
      if (plan.action !== 'create' && plan.action !== 'update') continue;
      // Savepoint: chyba jednoho řádku nesmí shodit transakci celého importu.
      await manager.query('SAVEPOINT asset_import_row');
      try {
        const a = plan.asset;
        const dto = {
          ...(a.name !== undefined ? { name: a.name } : {}),
          ...(a.categoryName !== undefined ? { categoryId: await categoryId(a.categoryName) } : {}),
          ...(a.manufacturer !== undefined ? { manufacturer: a.manufacturer } : {}),
          ...(a.model !== undefined ? { model: a.model } : {}),
          ...(a.serialNumber !== undefined ? { serialNumber: a.serialNumber } : {}),
          ...(a.inventoryNumber !== undefined ? { inventoryNumber: a.inventoryNumber } : {}),
          ...(a.locationName !== undefined
            ? { homeLocationId: await locationId(a.locationName) }
            : {}),
        };
        let assetId = plan.assetId;
        if (plan.action === 'create') {
          assetId = (await this.assets.create({ name: a.name!, ...dto })).id;
        } else if (Object.keys(dto).length) {
          await this.assets.update(assetId!, dto);
        }

        const p = plan.purchase;
        if (Object.keys(p).length) {
          const repo = this.repo(AssetPurchase);
          const row =
            (await repo.findOne({ where: { assetId } })) ??
            repo.create({ tenantId, assetId, currency: 'CZK', vatPayer, condition: 'new' });
          const datesBefore = [row.purchasedOn, row.inServiceOn, row.condition].join('|');
          if (p.purchasedOn) row.purchasedOn = p.purchasedOn;
          if (p.condition) row.condition = p.condition;
          if (p.inServiceOn) row.inServiceOn = p.inServiceOn;
          if (p.supplier) row.supplier = p.supplier;
          if (p.documentNumber) row.documentNumber = p.documentNumber;
          if (p.price) {
            Object.assign(row, p.price);
            row.vatPayer = vatPayer;
          }
          const saved = await repo.save(row);
          if ([saved.purchasedOn, saved.inServiceOn, saved.condition].join('|') !== datesBefore)
            await this.purchases.rebaseWarranties(assetId!, saved);
        }

        if (plan.warranty) {
          const repo = this.repo(AssetWarranty);
          if (plan.warranty.op === 'create') {
            await repo.save(
              repo.create({
                tenantId,
                assetId,
                title: 'Záruka výrobce',
                startBasis: plan.warranty.startBasis ?? 'custom',
                startsOn: plan.warranty.startsOn,
                months: null,
                endsOn: plan.warranty.endsOn,
              }),
            );
          } else {
            await repo.update(
              { id: plan.warranty.id },
              { endsOn: plan.warranty.endsOn, months: null },
            );
          }
        }
        await manager.query('RELEASE SAVEPOINT asset_import_row');
      } catch (e) {
        await manager.query('ROLLBACK TO SAVEPOINT asset_import_row');
        plan.action = 'error';
        plan.error = e instanceof Error ? e.message : 'Uložení selhalo';
      }
    }
  }
}
