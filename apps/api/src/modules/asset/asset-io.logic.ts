/**
 * Import/export položek (Excel .xlsx i CSV) – čistá logika bez DB.
 *
 * - Hlavičky jsou česky; import přijme i anglické a technické názvy (aliasy),
 *   bez ohledu na diakritiku a velikost písmen.
 * - CSV: export se středníkem + UTF-8 BOM (český Excel), import pozná `;`, `,`
 *   i tabulátor a kódování UTF-8 i Windows-1250 (CSV uložené z Excelu).
 * - Párování: sloupec ID (z exportu), jinak inventární číslo. Prázdná buňka
 *   při úpravě = beze změny (nic se nemaže).
 */
import { parseCsv, type CsvDelimiter } from './csv.logic';
import {
  computePrice,
  isIsoDate,
  type PriceBreakdown,
  type PurchaseCondition,
} from './purchase.logic';

export type ColumnKey =
  | 'id'
  | 'name'
  | 'category'
  | 'manufacturer'
  | 'model'
  | 'serialNumber'
  | 'registrationPlate'
  | 'inventoryNumber'
  | 'homeLocation'
  | 'status'
  | 'holder'
  | 'purchasedOn'
  | 'condition'
  | 'inServiceOn'
  | 'supplier'
  | 'documentNumber'
  | 'priceNet'
  | 'vatRate'
  | 'priceGross'
  | 'warrantyEndsOn';

export type ColumnKind = 'text' | 'date' | 'money' | 'percent';

export interface ColumnDef {
  key: ColumnKey;
  label: string;
  aliases: string[];
  kind: ColumnKind;
  /** Jen v exportu, import sloupec ignoruje. */
  exportOnly?: boolean;
  /** Sloupec pořízení – čte/zapisuje jen oprávnění `asset.purchase.*`. */
  purchase?: boolean;
  help: string;
  example: string;
  width: number;
}

export const ASSET_COLUMNS: ColumnDef[] = [
  {
    key: 'id',
    label: 'ID',
    aliases: ['id', 'assetid'],
    kind: 'text',
    help: 'Interní ID z exportu – neměň ho. Řádek s ID upraví tu položku; prázdné = nová položka (nebo párování podle inventárního čísla).',
    example: '',
    width: 38,
  },
  {
    key: 'name',
    label: 'Název',
    aliases: ['nazev', 'name', 'polozka', 'nazevpolozky'],
    kind: 'text',
    help: 'Povinné u nové položky.',
    example: 'Aku vrtačka Makita DDF485',
    width: 34,
  },
  {
    key: 'category',
    label: 'Kategorie',
    aliases: ['kategorie', 'category', 'sekce'],
    kind: 'text',
    help: 'Název kategorie; neexistující se založí.',
    example: 'Nářadí',
    width: 18,
  },
  {
    key: 'manufacturer',
    label: 'Výrobce',
    aliases: ['vyrobce', 'manufacturer', 'znacka'],
    kind: 'text',
    help: '',
    example: 'Makita',
    width: 16,
  },
  {
    key: 'model',
    label: 'Model',
    aliases: ['model', 'typ'],
    kind: 'text',
    help: '',
    example: 'DDF485Z',
    width: 16,
  },
  {
    key: 'serialNumber',
    label: 'Výrobní číslo',
    aliases: ['vyrobnicislo', 'serialnumber', 'seriovecislo', 'sn', 'serial'],
    kind: 'text',
    help: '',
    example: 'SN123456',
    width: 18,
  },
  {
    key: 'registrationPlate',
    label: 'SPZ',
    aliases: ['spz', 'rz', 'registracniznacka', 'registrationplate', 'licenseplate', 'poznavacka'],
    kind: 'text',
    help: 'Registrační značka vozidla, např. 1AB 2345.',
    example: '',
    width: 12,
  },
  {
    key: 'inventoryNumber',
    label: 'Inventární číslo',
    aliases: ['inventarnicislo', 'inventorynumber', 'invcislo', 'inventarni'],
    kind: 'text',
    help: 'Jedinečné v rámci firmy. Bez ID se podle něj páruje existující položka (úprava místo založení).',
    example: 'INV-0001',
    width: 18,
  },
  {
    key: 'homeLocation',
    label: 'Domovské místo',
    aliases: ['domovskemisto', 'homelocation', 'misto', 'umisteni', 'patrido'],
    kind: 'text',
    help: 'Název místa, kam položka patří; neexistující se založí.',
    example: 'Sklad A',
    width: 20,
  },
  {
    key: 'status',
    label: 'Stav',
    aliases: ['stav', 'status'],
    kind: 'text',
    exportOnly: true,
    help: 'Jen pro čtení – stav mění pohyby (výdej, vrácení…).',
    example: '',
    width: 14,
  },
  {
    key: 'holder',
    label: 'Kdo ji má',
    aliases: ['kdojima', 'holder', 'drzitel'],
    kind: 'text',
    exportOnly: true,
    help: 'Jen pro čtení.',
    example: '',
    width: 20,
  },
  {
    key: 'purchasedOn',
    label: 'Datum pořízení',
    aliases: ['datumporizeni', 'purchasedon', 'porizeno', 'datumnakupu'],
    kind: 'date',
    purchase: true,
    help: 'Kdy firma věc koupila, např. 1.3.2026 nebo 2026-03-01. Od něj běží záruka prodejce.',
    example: '1.3.2026',
    width: 15,
  },
  {
    key: 'condition',
    label: 'Nové / použité',
    aliases: ['novepouzite', 'condition', 'stavporizeni', 'stavpriporizeni', 'pouzite'],
    kind: 'text',
    purchase: true,
    help: '„nové" nebo „použité". Prázdné u nové položky = nové.',
    example: 'nové',
    width: 14,
  },
  {
    key: 'inServiceOn',
    label: 'Uvedeno do provozu',
    aliases: [
      'uvedenodoprovozu',
      'datumuvedenidoprovozu',
      'prvniuvedenidoprovozu',
      'vprovozuod',
      'inserviceon',
    ],
    kind: 'date',
    purchase: true,
    help: 'První uvedení do provozu – u použité věci u předchozího majitele (od něj běží zbytek záruky výrobce). U nové prázdné = datum pořízení.',
    example: '',
    width: 17,
  },
  {
    key: 'supplier',
    label: 'Dodavatel',
    aliases: ['dodavatel', 'supplier', 'prodejce'],
    kind: 'text',
    purchase: true,
    help: '',
    example: 'Alza.cz a.s.',
    width: 20,
  },
  {
    key: 'documentNumber',
    label: 'Číslo dokladu',
    aliases: ['cislodokladu', 'documentnumber', 'cislofaktury', 'faktura'],
    kind: 'text',
    purchase: true,
    help: 'Číslo faktury / dokladu.',
    example: 'FV2026-0042',
    width: 16,
  },
  {
    key: 'priceNet',
    label: 'Cena bez DPH',
    aliases: ['cenabezdph', 'pricenet', 'zaklad'],
    kind: 'money',
    purchase: true,
    help: 'V Kč. Stačí jedna z cen – druhá se dopočítá ze sazby.',
    example: '4958,68',
    width: 15,
  },
  {
    key: 'vatRate',
    label: 'Sazba DPH %',
    aliases: ['sazbadph', 'sazbadphprocent', 'vatrate', 'dph', 'sazba'],
    kind: 'percent',
    purchase: true,
    help: 'Např. 21, 12 nebo 0. Prázdné = sazba firmy (plátce) / neuvedeno (neplátce).',
    example: '21',
    width: 12,
  },
  {
    key: 'priceGross',
    label: 'Cena s DPH',
    aliases: ['cenasdph', 'pricegross', 'cenacelkem', 'cena'],
    kind: 'money',
    purchase: true,
    help: 'V Kč.',
    example: '6000',
    width: 15,
  },
  {
    key: 'warrantyEndsOn',
    label: 'Konec záruky',
    aliases: ['koneczaruky', 'warrantyendson', 'zarukado', 'zaruka'],
    kind: 'date',
    purchase: true,
    help: 'Datum konce záruky. Položka bez záruky dostane „Záruka výrobce"; víc záruk se upravuje v detailu položky.',
    example: '1.3.2028',
    width: 15,
  },
];

export const IMPORT_MAX_ROWS = 5000;
export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;

/** „Inventární číslo" → „inventarnicislo" (bez diakritiky, mezer a znaků). */
export function normalizeHeader(h: string): string {
  return h
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

const ALIAS = new Map<string, ColumnKey>();
for (const c of ASSET_COLUMNS) {
  ALIAS.set(normalizeHeader(c.label), c.key);
  for (const a of c.aliases) ALIAS.set(normalizeHeader(a), c.key);
}

export interface HeaderMap {
  index: Partial<Record<ColumnKey, number>>;
  unknown: string[];
  duplicate: string[];
}

export function mapHeader(headers: string[]): HeaderMap {
  const index: Partial<Record<ColumnKey, number>> = {};
  const unknown: string[] = [];
  const duplicate: string[] = [];
  headers.forEach((h, i) => {
    if (!h.trim()) return;
    const key = ALIAS.get(normalizeHeader(h));
    if (!key) unknown.push(h.trim());
    else if (index[key] !== undefined) duplicate.push(h.trim());
    else index[key] = i;
  });
  return { index, unknown, duplicate };
}

/** Oddělovač podle hlavičky (mimo uvozovky): nejčastější z `;`, `,`, tab. */
export function detectDelimiter(text: string): CsvDelimiter {
  const counts: Record<CsvDelimiter, number> = { ';': 0, ',': 0, '\t': 0 };
  let inQuotes = false;
  for (const ch of text) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (ch === '\n' || ch === '\r')) break;
    else if (!inQuotes && ch in counts) counts[ch as CsvDelimiter]++;
  }
  const best = (Object.keys(counts) as CsvDelimiter[]).sort((a, b) => counts[b] - counts[a])[0];
  return counts[best] > 0 ? best : ';';
}

/** Text CSV z bajtů: UTF-8 (s/bez BOM), jinak Windows-1250 (český Excel). */
export function decodeCsv(buf: Buffer): string {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
    return text.replace(/^\uFEFF/, '');
  } catch {
    return new TextDecoder('windows-1250').decode(buf);
  }
}

export function parseCsvFile(buf: Buffer): string[][] {
  const text = decodeCsv(buf);
  return parseCsv(text, detectDelimiter(text));
}

/** Číslo z buňky: „12 345,50 Kč", „12345.5", „21 %". Prázdné = null, nesmysl = NaN. */
export function parseNumber(raw: string): number | null {
  const v = raw
    .replace(/[\s\u00a0\u202f]/g, '')
    .replace(/(kč|czk|%)$/i, '')
    .trim();
  if (v === '') return null;
  // „1.234,50" (tečka tisíce + desetinná čárka) i „1,234.50"
  let norm = v;
  if (v.includes(',') && v.includes('.')) {
    norm =
      v.lastIndexOf(',') > v.lastIndexOf('.')
        ? v.replace(/\./g, '').replace(',', '.')
        : v.replace(/,/g, '');
  } else {
    norm = v.replace(',', '.');
  }
  return /^-?\d+(\.\d+)?$/.test(norm) ? Number(norm) : NaN;
}

/** Datum z buňky: „1.3.2026", „1. 3. 2026", „2026-03-01". Prázdné = null, nesmysl = 'invalid'. */
export function parseDate(raw: string): string | null | 'invalid' {
  const v = raw.trim();
  if (v === '') return null;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(v);
  const cz = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/.exec(v);
  let y: number, m: number, d: number;
  if (iso) [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (cz) [y, m, d] = [Number(cz[3]), Number(cz[2]), Number(cz[1])];
  else return 'invalid';
  const out = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return isIsoDate(out) ? out : 'invalid';
}

export function formatCzDate(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d}.${m}.${y}`;
}

/** Číslo pro CSV v českém Excelu: desetinná čárka, bez oddělovače tisíců. */
export function formatCzNumber(n: number | null): string {
  if (n == null) return '';
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

/** Ceny k uložení z importu; null = sloupce cen nevyplněné (beze změny). */
export function resolveImportPrice(
  input: { net: number | null; gross: number | null; rate: number | null },
  existing: PriceBreakdown | null,
  vat: { payer: boolean; defaultRate: number },
): PriceBreakdown | null {
  const { net, gross, rate } = input;
  if (net == null && gross == null && rate == null) return null;
  const fallbackRate = rate ?? existing?.vatRate ?? (vat.payer ? vat.defaultRate : null);
  if (net != null && gross != null) {
    const derived = net > 0 ? Math.round((gross / net - 1) * 10000) / 100 : null;
    return { priceNet: net, vatRate: rate ?? derived, priceGross: gross };
  }
  if (net != null) return computePrice({ amount: net, includesVat: false, vatRate: fallbackRate });
  if (gross != null)
    return computePrice({ amount: gross, includesVat: true, vatRate: fallbackRate });
  // Jen sazba – přepočítá se ze stávající ceny.
  if (existing?.priceNet != null)
    return computePrice({ amount: existing.priceNet, includesVat: false, vatRate: rate });
  if (existing?.priceGross != null)
    return computePrice({ amount: existing.priceGross, includesVat: true, vatRate: rate });
  return { priceNet: null, vatRate: rate, priceGross: null };
}

export const CONDITION_LABELS: Record<PurchaseCondition, string> = {
  new: 'nové',
  used: 'použité',
};

/** „nové"/„použité" (i „nový", „new", „used", „bazar"…). Prázdné = null, nesmysl = 'invalid'. */
export function parseCondition(raw: string): PurchaseCondition | null | 'invalid' {
  const v = normalizeHeader(raw);
  if (v === '') return null;
  if (/^(n|nov[aeyi]?|new)$/.test(v)) return 'new';
  if (/^(p|u|pouzit[aeyi]?|used|bazar[a-z]*|secondhand|repas[a-z]*)$/.test(v)) return 'used';
  return 'invalid';
}

export const STATUS_LABELS: Record<string, string> = {
  available: 'Dostupná',
  assigned: 'Přidělená',
  loaned: 'Půjčená',
  in_transfer: 'Na cestě',
  reserved: 'Rezervovaná',
  service: 'V servisu',
  damaged: 'Poškozená',
  lost: 'Ztracená',
  retired: 'Vyřazená',
};
