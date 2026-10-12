/**
 * Exporty do Excelu – katalog sloupců a listů, ze kterého si firma v Nastavení
 * → Exporty vybírá, co soubory obsahují. Uloženo v `tenants.settings.exports`
 * jako `{ [kind]: { columns: string[], sheets: string[] } }`. Pořadí sloupců
 * je vždy podle katalogu; neznámé klíče se ignorují.
 */

export type ExportKind = 'stockInventory' | 'vehicleInventory';

export interface ExportOptionDef {
  key: string;
  label: string;
  /** Zapnuté, dokud firma výběr nezmění. */
  default: boolean;
  help?: string;
  /** Údaj z pořízení – v exportu jen pro oprávnění `asset.purchase.view`. */
  purchase?: boolean;
}

const PURCHASE_HELP = 'Jen pro uživatele s oprávněním k pořízení a cenám.';

export interface ExportDefinition {
  kind: ExportKind;
  title: string;
  description: string;
  columns: ExportOptionDef[];
  sheets: ExportOptionDef[];
}

export const EXPORT_DEFINITIONS: Record<ExportKind, ExportDefinition> = {
  stockInventory: {
    kind: 'stockInventory',
    title: 'Inventura skladu',
    description: 'Inventura místa, osoby nebo kontejneru – nalezeno / chybí / navíc.',
    columns: [
      { key: 'result', label: 'Výsledek', default: true, help: 'Nalezeno / Chybí / Navíc' },
      { key: 'name', label: 'Název', default: true },
      { key: 'inventoryNumber', label: 'Inventární číslo', default: true },
      { key: 'category', label: 'Kategorie', default: true },
      { key: 'manufacturer', label: 'Výrobce', default: false },
      { key: 'model', label: 'Model', default: false },
      { key: 'serialNumber', label: 'Výrobní číslo', default: true },
      { key: 'registrationPlate', label: 'SPZ', default: false },
      { key: 'homeLocation', label: 'Domovské místo', default: true },
      { key: 'holder', label: 'Kde je podle evidence', default: true },
      { key: 'status', label: 'Stav položky', default: false },
      {
        key: 'condition',
        label: 'Nové / použité',
        default: false,
        purchase: true,
        help: PURCHASE_HELP,
      },
      {
        key: 'purchasedOn',
        label: 'Datum pořízení',
        default: false,
        purchase: true,
        help: PURCHASE_HELP,
      },
      {
        key: 'inServiceOn',
        label: 'Uvedeno do provozu',
        default: false,
        purchase: true,
        help: `U nové věci bez data = datum pořízení. ${PURCHASE_HELP}`,
      },
      { key: 'scannedAt', label: 'Naskenováno', default: true },
    ],
    sheets: [
      {
        key: 'summary',
        label: 'List „Souhrn"',
        default: true,
        help: 'Co se inventarizovalo, kdy a počty nalezeno / chybí / navíc.',
      },
    ],
  },
  vehicleInventory: {
    kind: 'vehicleInventory',
    title: 'Inventura vozidel',
    description: 'Stav vozidel k období – tachometr, ujeté km a servis.',
    columns: [
      { key: 'name', label: 'Vozidlo', default: true },
      { key: 'registrationPlate', label: 'SPZ', default: true },
      { key: 'inventoryNumber', label: 'Inventární číslo', default: true },
      { key: 'serialNumber', label: 'VIN / výrobní číslo', default: false },
      { key: 'category', label: 'Kategorie', default: false },
      { key: 'holder', label: 'Kdo ho má', default: true },
      {
        key: 'condition',
        label: 'Nové / použité',
        default: false,
        purchase: true,
        help: PURCHASE_HELP,
      },
      {
        key: 'purchasedOn',
        label: 'Datum pořízení',
        default: true,
        purchase: true,
        help: PURCHASE_HELP,
      },
      {
        key: 'inServiceOn',
        label: 'Uvedeno do provozu',
        default: true,
        purchase: true,
        help: `U nové věci bez data = datum pořízení. ${PURCHASE_HELP}`,
      },
      { key: 'odometerStart', label: 'Tachometr na začátku', default: true },
      { key: 'odometerStartAt', label: 'Odečet začátku (datum)', default: false },
      { key: 'odometerEnd', label: 'Tachometr na konci', default: true },
      { key: 'odometerEndAt', label: 'Odečet konce (datum)', default: true },
      { key: 'distance', label: 'Ujeto za období (km)', default: true },
      {
        key: 'distanceSincePrevious',
        label: 'Ujeto od předchozího záznamu (km)',
        default: true,
        help: 'Poslední stav tachometru − předposlední záznam.',
      },
      { key: 'previousOdometerAt', label: 'Předchozí záznam (datum)', default: false },
      {
        key: 'distanceSincePurchase',
        label: 'Ujeto od pořízení (km)',
        default: true,
        help: 'Poslední stav − stav při pořízení (nové = 0 km, použité = odečet ke dni pořízení, jinak první odečet po něm).',
      },
      { key: 'nextService', label: 'Nejbližší servis', default: true },
      {
        key: 'kmToService',
        label: 'Km do servisu',
        default: true,
        help: 'Záporné číslo = kolik km je po servisu.',
      },
      { key: 'serviceDueOn', label: 'Termín servisu', default: true },
      {
        key: 'daysToService',
        label: 'Dní do servisu',
        default: true,
        help: 'Záporné číslo = kolik dní je po termínu.',
      },
      { key: 'serviceStatus', label: 'Stav servisu', default: true },
      { key: 'servicesInPeriod', label: 'Servisy v období', default: true },
      { key: 'note', label: 'Poznámka', default: true },
    ],
    sheets: [
      {
        key: 'summary',
        label: 'List „Souhrn"',
        default: true,
        help: 'Období, počet vozidel a celkem ujeté km.',
      },
      {
        key: 'plans',
        label: 'List „Servisní intervaly"',
        default: false,
        help: 'Každý servisní interval každého vozidla na samostatném řádku.',
      },
      {
        key: 'services',
        label: 'List „Servisy v období"',
        default: false,
        help: 'Servisy provedené v období inventury.',
      },
    ],
  },
};

export interface ExportSelection {
  columns: string[];
  sheets: string[];
}

export type ExportSettings = Record<ExportKind, ExportSelection>;

const defaultsOf = (opts: ExportOptionDef[]) => opts.filter((o) => o.default).map((o) => o.key);

/** Výběr pro export z `tenants.settings.exports` – očištěný, s výchozími hodnotami. */
export function resolveExportSelection(kind: ExportKind, settings: unknown): ExportSelection {
  const def = EXPORT_DEFINITIONS[kind];
  const raw = (settings as { exports?: Record<string, unknown> } | null | undefined)?.exports?.[
    kind
  ] as Partial<Record<'columns' | 'sheets', unknown>> | undefined;
  const pick = (opts: ExportOptionDef[], value: unknown): string[] => {
    if (!Array.isArray(value)) return defaultsOf(opts);
    const chosen = new Set(value.filter((v): v is string => typeof v === 'string'));
    return opts.filter((o) => chosen.has(o.key)).map((o) => o.key);
  };
  const columns = pick(def.columns, raw?.columns);
  return {
    // Bez sloupců by export neměl smysl – vrátí se výchozí.
    columns: columns.length ? columns : defaultsOf(def.columns),
    sheets: pick(def.sheets, raw?.sheets),
  };
}

export function resolveExportSettings(settings: unknown): ExportSettings {
  return {
    stockInventory: resolveExportSelection('stockInventory', settings),
    vehicleInventory: resolveExportSelection('vehicleInventory', settings),
  };
}
