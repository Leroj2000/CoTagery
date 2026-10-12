import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { In, Repository } from 'typeorm';
import {
  EXPORT_DEFINITIONS,
  resolveExportSelection,
  type ExportKind,
  type ExportSelection,
} from '@tagery/shared';
import { TenantContextService } from '../../core/tenancy/tenant-context.service';
import { Location } from '../../core/domain/entities/location.entity';
import { Person } from '../../core/domain/entities/person.entity';
import { Tenant } from '../../core/domain/entities/tenant.entity';
import { Asset } from '../asset/entities/asset.entity';
import { CONDITION_LABELS, STATUS_LABELS } from '../asset/asset-io.logic';
import { AssetPurchase } from '../asset/entities/asset-purchase.entity';
import { effectiveInService } from '../asset/purchase.logic';
import { AuthzService } from '../../core/rbac/authz.service';
import type { RequestUser } from '../../core/auth/jwt-auth.guard';
import { InventoryScan } from './entities/inventory-scan.entity';
import { InventoryService, type InventoryDetail } from './inventory.service';
import { SERVICE_STATUS_LABELS, pragueDay } from './vehicle-inventory.logic';

export interface ExportFile {
  buffer: Buffer;
  mime: string;
  fileName: string;
}

type Cell = string | number | Date | null;
type ColumnKind = 'text' | 'date' | 'datetime' | 'number' | 'km';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const HEADER_FILL = 'FFEEF2FF';

/** Typ a šířka sloupců exportu (labely jsou v katalogu `@tagery/shared`). */
const COLUMN_FORMAT: Record<string, { kind: ColumnKind; width: number }> = {
  result: { kind: 'text', width: 12 },
  name: { kind: 'text', width: 32 },
  inventoryNumber: { kind: 'text', width: 16 },
  category: { kind: 'text', width: 18 },
  manufacturer: { kind: 'text', width: 16 },
  model: { kind: 'text', width: 16 },
  serialNumber: { kind: 'text', width: 20 },
  registrationPlate: { kind: 'text', width: 12 },
  homeLocation: { kind: 'text', width: 20 },
  holder: { kind: 'text', width: 22 },
  status: { kind: 'text', width: 14 },
  scannedAt: { kind: 'datetime', width: 18 },
  condition: { kind: 'text', width: 14 },
  purchasedOn: { kind: 'date', width: 15 },
  inServiceOn: { kind: 'date', width: 17 },
  odometerStart: { kind: 'km', width: 14 },
  odometerStartAt: { kind: 'date', width: 14 },
  odometerEnd: { kind: 'km', width: 14 },
  odometerEndAt: { kind: 'date', width: 14 },
  distance: { kind: 'km', width: 14 },
  previousOdometerAt: { kind: 'date', width: 14 },
  distanceSincePrevious: { kind: 'km', width: 16 },
  distanceSincePurchase: { kind: 'km', width: 14 },
  nextService: { kind: 'text', width: 28 },
  kmToService: { kind: 'km', width: 13 },
  serviceDueOn: { kind: 'date', width: 14 },
  daysToService: { kind: 'number', width: 13 },
  serviceStatus: { kind: 'text', width: 18 },
  servicesInPeriod: { kind: 'text', width: 36 },
  note: { kind: 'text', width: 36 },
};

const PURCHASE_KEYS = new Set(['condition', 'purchasedOn', 'inServiceOn']);

const RESULT_LABELS = { found: 'Nalezeno', missing: 'Chybí', unexpected: 'Navíc' } as const;

/** `YYYY-MM-DD` → Date pro Excel (bez posunu zóny). */
function day(iso: string | null): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Okamžik → „místní" čas Prahy pro Excel (Excel časové zóny nezná). */
function localTime(at: Date | string | null): Date | null {
  if (!at) return null;
  const d = new Date(at);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Prague',
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  return new Date(Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute));
}

function fmtDay(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d}. ${m}. ${y}`;
}

/** Bezpečný název souboru (ASCII, bez diakritiky). */
function slug(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'inventura'
  );
}

/**
 * Export inventury do Excelu. Sloupce a listy podle `tenants.settings.exports`
 * (Nastavení → Exporty), výchozí z katalogu `EXPORT_DEFINITIONS`.
 */
@Injectable()
export class InventoryExportService {
  constructor(
    private readonly context: TenantContextService,
    private readonly inventory: InventoryService,
    private readonly authz: AuthzService,
  ) {}

  private repo<T extends object>(entity: { new (): T }): Repository<T> {
    return this.context.manager.getRepository(entity);
  }

  /** Výběr z nastavení; údaje z pořízení jen s `asset.purchase.view`. */
  private async selection(kind: ExportKind, canPurchase: boolean): Promise<ExportSelection> {
    const tenant = await this.repo(Tenant).findOne({ where: { id: this.context.tenantId } });
    const sel = resolveExportSelection(kind, tenant?.settings);
    if (canPurchase) return sel;
    const hidden = new Set(
      EXPORT_DEFINITIONS[kind].columns.filter((c) => c.purchase).map((c) => c.key),
    );
    return { ...sel, columns: sel.columns.filter((c) => !hidden.has(c)) };
  }

  /** Data pořízení položek pro sloupce Nové/použité, Datum pořízení, Uvedeno do provozu. */
  private async purchaseCells(
    assetIds: string[],
    columns: string[],
  ): Promise<Map<string, Record<string, Cell>>> {
    const result = new Map<string, Record<string, Cell>>();
    if (!assetIds.length || !columns.some((c) => PURCHASE_KEYS.has(c))) return result;
    const purchases = await this.repo(AssetPurchase).find({ where: { assetId: In(assetIds) } });
    for (const p of purchases)
      result.set(p.assetId, {
        condition: CONDITION_LABELS[p.condition] ?? null,
        purchasedOn: day(p.purchasedOn),
        inServiceOn: day(effectiveInService(p)),
      });
    return result;
  }

  async export(checkId: string, user: RequestUser): Promise<ExportFile> {
    const detail = await this.inventory.detail(checkId);
    const canPurchase =
      (await this.authz.isModuleActive(user, 'purchase')) &&
      (await this.authz.can(user, 'asset.purchase.view')).allowed;
    return detail.check.kind === 'vehicle'
      ? this.vehicles(detail, canPurchase)
      : this.stock(detail, canPurchase);
  }

  // --- Inventura skladu ---

  private async stock(detail: InventoryDetail, canPurchase: boolean): Promise<ExportFile> {
    const { check } = detail;
    const sel = await this.selection('stockInventory', canPurchase);
    const purchase = await this.purchaseCells(
      [...detail.found, ...detail.missing, ...detail.unexpected].map((a) => a.id),
      sel.columns,
    );
    const locations = await this.repo(Location).find();
    const people = await this.repo(Person).find();
    const scans = await this.repo(InventoryScan).find({ where: { checkId: check.id } });
    const locName = new Map(locations.map((l) => [l.id, l.name]));
    const perName = new Map(people.map((p) => [p.id, p.name]));
    const scannedAt = new Map(scans.map((s) => [s.assetId, s.createdAt]));

    const subjectId = check.subjectId ?? check.locationId;
    let subject = '—';
    if (check.subjectType === 'person') subject = perName.get(subjectId ?? '') ?? 'osoba';
    else if (check.subjectType === 'asset') {
      const box = subjectId ? await this.repo(Asset).findOne({ where: { id: subjectId } }) : null;
      subject = box?.name ?? 'kontejner';
    } else subject = locName.get(subjectId ?? '') ?? 'místo';

    const holder = (a: Asset): string | null =>
      a.currentHolderType === 'person'
        ? (perName.get(a.currentHolderId ?? '') ?? null)
        : a.currentHolderType === 'location'
          ? (locName.get(a.currentHolderId ?? '') ?? null)
          : null;

    const rows = (
      [
        ['missing', detail.missing],
        ['unexpected', detail.unexpected],
        ['found', detail.found],
      ] as const
    ).flatMap(([result, list]) =>
      list.map((a): Record<string, Cell> => ({
        result: RESULT_LABELS[result],
        name: a.name,
        inventoryNumber: a.inventoryNumber,
        category: a.category,
        manufacturer: a.manufacturer,
        model: a.model,
        serialNumber: a.serialNumber,
        registrationPlate: a.registrationPlate,
        homeLocation: locName.get(a.homeLocationId ?? '') ?? null,
        holder: holder(a),
        status: STATUS_LABELS[a.status] ?? a.status,
        scannedAt: localTime(scannedAt.get(a.id) ?? null),
        ...purchase.get(a.id),
      })),
    );

    // Pořadí listů = pořadí vytvoření: tabulka první, ať Excel otevře data.
    const wb = this.workbook();
    this.tableSheet(wb, 'Položky', 'stockInventory', sel.columns, rows, (row, ws, r) => {
      const fill = { Chybí: 'FFFEE2E2', Navíc: 'FFFEF3C7' }[String(row.result)];
      if (fill)
        ws.getRow(r).eachCell((c) => {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
        });
    });
    if (sel.sheets.includes('summary')) {
      this.summarySheet(wb, 'Inventura skladu', [
        ['Inventarizováno', subject],
        ['Zahájeno', localTime(check.createdAt)],
        ['Uzavřeno', check.closedAt ? localTime(check.closedAt) : 'probíhá'],
        ['Očekáváno položek', check.expectedAssetIds.length],
        ['Nalezeno', detail.found.length],
        ['Chybí', detail.missing.length],
        ['Navíc', detail.unexpected.length],
      ]);
    }
    return this.file(wb, `inventura-${slug(subject)}-${pragueDay(check.createdAt)}`);
  }

  // --- Inventura vozidel ---

  private async vehicles(detail: InventoryDetail, canPurchase: boolean): Promise<ExportFile> {
    const { check } = detail;
    const sel = await this.selection('vehicleInventory', canPurchase);
    const vehicles = detail.vehicles ?? [];
    const purchase = await this.purchaseCells(
      vehicles.map((v) => v.assetId),
      sel.columns,
    );
    const rows = vehicles.map((v): Record<string, Cell> => ({
      name: v.name,
      registrationPlate: v.registrationPlate ?? null,
      inventoryNumber: v.inventoryNumber,
      serialNumber: v.serialNumber,
      category: v.category,
      holder: v.holder,
      odometerStart: v.odometerStart,
      odometerStartAt: day(v.odometerStartAt ? pragueDay(new Date(v.odometerStartAt)) : null),
      odometerEnd: v.odometerEnd,
      odometerEndAt: day(v.odometerEndAt ? pragueDay(new Date(v.odometerEndAt)) : null),
      distance: v.distance,
      previousOdometerAt: day(
        v.previousOdometerAt ? pragueDay(new Date(v.previousOdometerAt)) : null,
      ),
      distanceSincePrevious: v.distanceSincePrevious ?? null,
      distanceSincePurchase: v.distanceSincePurchase ?? null,
      nextService: v.next?.title ?? null,
      kmToService: v.next?.kmToService ?? null,
      serviceDueOn: day(v.next?.nextDueOn ?? null),
      daysToService: v.next?.daysToService ?? null,
      serviceStatus: v.next ? SERVICE_STATUS_LABELS[v.next.status] : null,
      servicesInPeriod:
        v.servicesInPeriod
          .map(
            (s) =>
              `${fmtDay(s.performedOn)} ${s.title}${s.meterValue != null ? ` (${s.meterValue.toLocaleString('cs-CZ')} km)` : ''}`,
          )
          .join('; ') || null,
      note: v.note,
      ...purchase.get(v.assetId),
    }));

    // Pořadí listů = pořadí vytvoření: tabulka první, ať Excel otevře data.
    const wb = this.workbook();
    this.tableSheet(wb, 'Vozidla', 'vehicleInventory', sel.columns, rows, (row, ws, r) => {
      const status = String(row.serviceStatus ?? '');
      const fill =
        status === SERVICE_STATUS_LABELS.overdue
          ? 'FFFEE2E2'
          : status === SERVICE_STATUS_LABELS.soon
            ? 'FFFEF3C7'
            : null;
      if (fill)
        ws.getRow(r).eachCell((c) => {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
        });
    });

    if (sel.sheets.includes('summary')) {
      const total = vehicles.reduce((sum, v) => sum + (v.distance ?? 0), 0);
      this.summarySheet(wb, 'Inventura vozidel', [
        ['Období', `${fmtDay(check.periodFrom)} – ${fmtDay(check.periodTo)}`],
        ['Zahájeno', localTime(check.createdAt)],
        ['Uzavřeno', check.closedAt ? localTime(check.closedAt) : 'probíhá'],
        ['Vozidel', vehicles.length],
        ['Ujeto celkem (km)', Math.round(total * 10) / 10],
        ['Po servisu', vehicles.filter((v) => v.next?.status === 'overdue').length],
        ['Servis se blíží', vehicles.filter((v) => v.next?.status === 'soon').length],
        ['Bez stavu tachometru', vehicles.filter((v) => v.odometerEnd == null).length],
      ]);
    }
    if (sel.sheets.includes('plans')) {
      const ws = wb.addWorksheet('Servisní intervaly', {
        views: [{ state: 'frozen', ySplit: 1 }],
      });
      ws.columns = [
        { header: 'Vozidlo', width: 30 },
        { header: 'SPZ', width: 12 },
        { header: 'Interval', width: 30 },
        { header: 'Stav', width: 18 },
        { header: 'Poslední servis', width: 15, style: { numFmt: 'd.m.yyyy' } },
        { header: 'Při km', width: 12, style: { numFmt: '#,##0' } },
        { header: 'Další servis při km', width: 17, style: { numFmt: '#,##0' } },
        { header: 'Km do servisu', width: 13, style: { numFmt: '#,##0' } },
        { header: 'Termín', width: 13, style: { numFmt: 'd.m.yyyy' } },
        { header: 'Dní do servisu', width: 13 },
      ];
      for (const v of vehicles)
        for (const p of v.plans)
          ws.addRow([
            v.name,
            v.registrationPlate ?? null,
            p.title,
            SERVICE_STATUS_LABELS[p.status],
            day(p.lastServiceOn),
            p.lastServiceMeter,
            p.nextMeter,
            p.kmToService,
            day(p.nextDueOn),
            p.daysToService,
          ]);
      this.styleHeader(ws);
    }

    if (sel.sheets.includes('services')) {
      const ws = wb.addWorksheet('Servisy v období', { views: [{ state: 'frozen', ySplit: 1 }] });
      ws.columns = [
        { header: 'Vozidlo', width: 30 },
        { header: 'SPZ', width: 12 },
        { header: 'Datum', width: 13, style: { numFmt: 'd.m.yyyy' } },
        { header: 'Co', width: 30 },
        { header: 'Stav km', width: 12, style: { numFmt: '#,##0' } },
        { header: 'Kdo prováděl', width: 24 },
      ];
      for (const v of vehicles)
        for (const s of v.servicesInPeriod)
          ws.addRow([
            v.name,
            v.registrationPlate ?? null,
            day(s.performedOn),
            s.title,
            s.meterValue,
            s.provider,
          ]);
      this.styleHeader(ws);
    }

    const scope = check.subjectId ? slug(vehicles[0]?.name ?? 'vozidlo') : 'vozidel';
    return this.file(wb, `inventura-${scope}-${check.periodFrom}-${check.periodTo}`);
  }

  // --- Excel ---

  private workbook(): ExcelJS.Workbook {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Tagery';
    return wb;
  }

  private styleHeader(ws: ExcelJS.Worksheet): void {
    const head = ws.getRow(1);
    head.font = { bold: true };
    head.eachCell((c) => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    });
    if (ws.columnCount > 0)
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ws.columnCount } };
  }

  private summarySheet(wb: ExcelJS.Workbook, title: string, lines: [string, Cell][]): void {
    const ws = wb.addWorksheet('Souhrn');
    ws.columns = [{ width: 24 }, { width: 36 }];
    ws.addRow([title]).font = { bold: true, size: 14 };
    ws.addRow([]);
    for (const [label, value] of lines) {
      const row = ws.addRow([label, value]);
      row.getCell(1).font = { bold: true };
      const cell = row.getCell(2);
      cell.alignment = { horizontal: 'left' };
      if (value instanceof Date)
        cell.numFmt = value.getUTCHours() || value.getUTCMinutes() ? 'd.m.yyyy h:mm' : 'd.m.yyyy';
    }
  }

  private tableSheet(
    wb: ExcelJS.Workbook,
    name: string,
    kind: ExportKind,
    columns: string[],
    rows: Record<string, Cell>[],
    decorate?: (row: Record<string, Cell>, ws: ExcelJS.Worksheet, rowNumber: number) => void,
  ): void {
    const labels = new Map(EXPORT_DEFINITIONS[kind].columns.map((c) => [c.key, c.label]));
    const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = columns.map((key) => ({
      header: labels.get(key) ?? key,
      key,
      width: COLUMN_FORMAT[key]?.width ?? 16,
    }));
    columns.forEach((key, i) => {
      const col = ws.getColumn(i + 1);
      const k = COLUMN_FORMAT[key]?.kind ?? 'text';
      if (k === 'date') col.numFmt = 'd.m.yyyy';
      if (k === 'datetime') col.numFmt = 'd.m.yyyy h:mm';
      if (k === 'km') col.numFmt = '#,##0';
    });
    rows.forEach((row, i) => {
      ws.addRow(columns.map((key) => row[key] ?? null));
      decorate?.(row, ws, i + 2);
    });
    this.styleHeader(ws);
  }

  private async file(wb: ExcelJS.Workbook, baseName: string): Promise<ExportFile> {
    return {
      buffer: Buffer.from(await wb.xlsx.writeBuffer()),
      mime: XLSX_MIME,
      fileName: `${baseName}.xlsx`,
    };
  }
}
