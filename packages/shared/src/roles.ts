/**
 * Role a oprávnění firmy – sdílená pravidla (API vynucuje, web zobrazuje).
 *
 * Model (po vzoru Dynamics/Power Platform security roles, Odoo access rights,
 * GitHub custom roles a Salesforce role hierarchy):
 * - oprávnění = `modul.zdroj.akce` z platformního katalogu,
 * - role = balíček oprávnění + úroveň (`rank`) v hierarchii,
 * - matice v UI: řádek = zdroj, sloupce = Zobrazit / Zakládat / Upravovat /
 *   Mazat + speciální akce zdroje,
 * - delegace: role spravuje a přiděluje jen role s NIŽŠÍ úrovní a nikdo nemůže
 *   roli přidat oprávnění, které sám nemá (žádná eskalace).
 */

/** Klíče systémových šablon (v DB malými písmeny, v členství historicky velkými). */
export const SYSTEM_ROLE_KEYS = [
  'owner',
  'admin',
  'manager',
  'editor',
  'viewer',
  'scan_only',
] as const;
export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number];

export const OWNER_ROLE_KEY = 'owner';
/** Prefix klíče vlastní role firmy. */
export const CUSTOM_ROLE_PREFIX = 'c_';

/** Úroveň vlastníka – nejvyšší, nikdo nad ním. */
export const OWNER_RANK = 100;

export function isSystemRoleKey(key: string): key is SystemRoleKey {
  return (SYSTEM_ROLE_KEYS as readonly string[]).includes(key.toLowerCase());
}

/** Klíč role, jak se ukládá do členství (systémové velkými kvůli kompatibilitě). */
export function membershipRoleKey(key: string): string {
  return isSystemRoleKey(key) ? key.toUpperCase() : key.toLowerCase();
}

/** Sloupce matice. `extra` = speciální akce zdroje (přidělovat, schvalovat…). */
export type PermissionColumn = 'view' | 'create' | 'update' | 'delete' | 'extra';

export const PERMISSION_COLUMNS: { key: Exclude<PermissionColumn, 'extra'>; label: string }[] = [
  { key: 'view', label: 'Zobrazit' },
  { key: 'create', label: 'Zakládat' },
  { key: 'update', label: 'Upravovat' },
  { key: 'delete', label: 'Mazat' },
];

/** Akce → sloupec matice (ostatní akce jsou „extra"). */
const ACTION_COLUMN: Record<string, PermissionColumn> = {
  view: 'view',
  create: 'create',
  invite: 'create',
  update: 'update',
  delete: 'delete',
  deactivate: 'delete',
};

const EXTRA_LABELS: Record<string, string> = {
  assign: 'Přidělovat',
  transfer: 'Převádět',
  perform: 'Provádět',
  bulk: 'Hromadně',
  use: 'Používat',
  manage: 'Spravovat',
  approve: 'Schvalovat',
  export: 'Exportovat',
  configure: 'Nastavovat',
  verify: 'Ověřovat',
  handle: 'Vyřizovat',
};

/** Sekce matice podle modulu (pořadí = pořadí v UI). */
const SECTIONS: { key: string; label: string; modules: string[] }[] = [
  { key: 'evidence', label: 'Evidence vybavení', modules: ['asset', 'carrier', 'object', 'found'] },
  { key: 'org', label: 'Firma, lidé a nastavení', modules: ['core'] },
  {
    key: 'modules',
    label: 'Rozšiřující moduly',
    modules: [
      'rental',
      'membership',
      'ticketing',
      'gallery',
      'product',
      'access',
      'attendance',
      'billing',
    ],
  },
];

const RESOURCE_LABELS: Record<string, string> = {
  'asset.item': 'Položky',
  'asset.movement': 'Výdej, vrácení, přesuny',
  'asset.dispatch': 'Hromadný výdej',
  'asset.scan': 'Skenování a identifikace',
  'asset.inventory': 'Inventury',
  'asset.identifier': 'Kódy položek',
  'asset.category': 'Kategorie',
  'asset.media': 'Fotky a dokumenty',
  'asset.issue': 'Závady a servis',
  'asset.reservation': 'Požadavky a rezervace',
  'asset.handoff': 'Předání mezi lidmi',
  'asset.selfloan': 'Samoobslužná výpůjčka',
  'carrier.item': 'Identifikátory (QR/NFC)',
  'object.item': 'Digitální objekty',
  'found.report': 'Nahlášené nálezy',
  'core.organization': 'Nastavení firmy',
  'core.member': 'Uživatelé',
  'core.role': 'Role a oprávnění',
  'core.scope': 'Omezení rozsahu (místa)',
  'core.location': 'Místa',
  'core.person': 'Osoby',
  'core.person_group': 'Skupiny osob',
  'core.group': 'Skupiny uživatelů',
  'core.audit': 'Auditní záznam',
  'core.module': 'Moduly',
  'core.integration': 'Integrace a webhooky',
  'rental.item': 'Půjčovna – nabídky a objednávky',
  'rental.renter': 'Půjčovna – ověření nájemců',
  'membership.card': 'Členství a karty',
  'ticketing.event': 'Akce a vstupenky',
  'gallery.item': 'Sdílené galerie',
  'product.item': 'Produktové karty',
  'access.point': 'Vstupy – místa',
  'access.terminal': 'Vstupy – terminál',
  'attendance.entry': 'Docházka – záznamy',
  'attendance.display': 'Docházka – kiosek',
  'attendance.report': 'Docházka – přehledy',
  'attendance.settings': 'Docházka – nastavení',
  'billing.subscription': 'Předplatné',
};

/** Položka katalogu oprávnění (z API `GET /roles`). */
export interface PermissionInfo {
  key: string;
  sensitivity: 'normal' | 'high' | string;
}

export interface PermissionCell {
  key: string;
  column: PermissionColumn;
  /** Popisek speciální akce (jen `extra`). */
  label?: string;
  sensitive: boolean;
}

export interface PermissionRow {
  resource: string;
  label: string;
  cells: PermissionCell[];
}

export interface PermissionSection {
  key: string;
  label: string;
  rows: PermissionRow[];
}

/**
 * Rozloží katalog do sekcí a řádků matice. Neznámé moduly/zdroje nezmizí –
 * spadnou do sekce „Ostatní" se surovým klíčem, aby šly vždy nastavit.
 */
export function buildPermissionMatrix(catalog: PermissionInfo[]): PermissionSection[] {
  const rows = new Map<string, PermissionRow>();
  for (const p of catalog) {
    const [module, resource, action] = p.key.split('.');
    if (!module || !resource || !action) continue;
    const resKey = `${module}.${resource}`;
    let row = rows.get(resKey);
    if (!row) {
      row = { resource: resKey, label: RESOURCE_LABELS[resKey] ?? resKey, cells: [] };
      rows.set(resKey, row);
    }
    const column = ACTION_COLUMN[action] ?? 'extra';
    row.cells.push({
      key: p.key,
      column,
      ...(column === 'extra' ? { label: EXTRA_LABELS[action] ?? action } : {}),
      sensitive: p.sensitivity === 'high',
    });
  }
  const order = (key: string) => {
    const i = Object.keys(RESOURCE_LABELS).indexOf(key);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  const sections: PermissionSection[] = SECTIONS.map((s) => ({
    key: s.key,
    label: s.label,
    rows: [],
  }));
  const other: PermissionSection = { key: 'other', label: 'Ostatní', rows: [] };
  for (const row of [...rows.values()].sort((a, b) => order(a.resource) - order(b.resource))) {
    const module = row.resource.split('.')[0];
    const idx = SECTIONS.findIndex((s) => s.modules.includes(module));
    (idx === -1 ? other : sections[idx]).rows.push(row);
  }
  return [...sections, other].filter((s) => s.rows.length > 0);
}

/**
 * Závislosti: kdo smí cokoli se zdrojem, musí ho i vidět (`.view`) – jako
 * „Read" u Dynamics. Doplní chybějící `view` klíče, pokud v katalogu existují.
 */
export function withImpliedPermissions(
  keys: Iterable<string>,
  catalog: Iterable<string>,
): string[] {
  const all = new Set(catalog);
  const out = new Set<string>();
  for (const k of keys) {
    if (!all.has(k)) continue;
    out.add(k);
    const [module, resource] = k.split('.');
    const view = `${module}.${resource}.view`;
    if (all.has(view)) out.add(view);
  }
  return [...out].sort();
}

/**
 * Pravidlo delegace pro úpravu oprávnění role: aktér mění jen oprávnění, která
 * sám má. Výsledek = (požadované ∩ aktérova) ∪ (dosavadní ∖ aktérova).
 */
export function delegateRolePermissions(
  requested: Iterable<string>,
  current: Iterable<string>,
  actor: Iterable<string>,
): string[] {
  const actorSet = new Set(actor);
  const out = new Set<string>();
  for (const k of requested) if (actorSet.has(k)) out.add(k);
  for (const k of current) if (!actorSet.has(k)) out.add(k);
  return [...out].sort();
}

/** Smí aktér s úrovní `actorRank` spravovat/přidělovat roli s úrovní `roleRank`? */
export function canManageRank(actorRank: number, roleRank: number): boolean {
  return roleRank < actorRank;
}
