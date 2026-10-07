/**
 * Štítky: katalog formátů (Niimbot role, archy A4) a šablony buněk.
 * Sdílené API (validace uložených šablon) i webem (editor, náhled, tisk).
 *
 * Rozložení štítku je pevné: QR vlevo (s logem firmy a „by tagery.tech"),
 * vpravo sloupec buněk pod sebou. Šablona určuje, které buňky a jak.
 */

/** Typ buňky: předvyplněné z položky, nebo vlastní pevný text. */
export type LabelCellKind = 'name' | 'code' | 'category' | 'location' | 'custom';
export type LabelCellSize = 'S' | 'M' | 'L';

export interface LabelCell {
  /** Stabilní id v rámci šablony (klíč pro editor). */
  id: string;
  kind: LabelCellKind;
  /** Jen pro `custom`: pevný text stejný na všech štítcích. */
  text?: string;
  size: LabelCellSize;
  bold: boolean;
  /** Max. počet řádků (zbytek se zkrátí výpustkou). */
  maxLines: 1 | 2 | 3;
}

export interface LabelTemplate {
  formatKey: string;
  cells: LabelCell[];
}

export const LABEL_CELL_LABELS: Record<LabelCellKind, string> = {
  name: 'Název položky',
  code: 'Evidenční kód',
  category: 'Kategorie',
  location: 'Umístění',
  custom: 'Vlastní text',
};

/** Předvyplněné typy (každý max. jednou v šabloně); `custom` lze přidat vícekrát. */
export const LABEL_PRESET_KINDS: LabelCellKind[] = ['name', 'code', 'category', 'location'];

export const LABEL_MAX_CELLS = 8;
export const LABEL_CUSTOM_TEXT_MAX = 120;

export interface NiimbotLabelSpec {
  /** Tiskový obraz v px (203 DPI, max. 384 px = šířka hlavy B1). */
  w_px: number;
  h_px: number;
  dpi: 203;
  offset_y_px: number;
  /** Rozměr ověřený tiskem na reálné tiskárně. */
  verified: boolean;
}

export interface SheetLabelSpec {
  cols: number;
  rows: number;
  /** Okraje archu a mezery mezi štítky v mm. */
  marginTopMm: number;
  marginLeftMm: number;
  gapXMm: number;
  gapYMm: number;
}

export interface LabelFormat {
  key: string;
  label: string;
  kind: 'niimbot' | 'sheet';
  widthMm: number;
  heightMm: number;
  niimbot?: NiimbotLabelSpec;
  sheet?: SheetLabelSpec;
}

/** Niimbot B1: 203 DPI ≈ 8 px/mm, tisková hlava 384 px (48 mm). */
function niimbot(w: number, h: number, verified = false): LabelFormat {
  return {
    key: `niimbot-${w}x${h}`,
    label: `Niimbot ${w} × ${h} mm`,
    kind: 'niimbot',
    widthMm: w,
    heightMm: h,
    niimbot: {
      w_px: Math.min(384, w * 8),
      h_px: h * 8,
      dpi: 203,
      offset_y_px: 4,
      verified,
    },
  };
}

function sheet(
  key: string,
  label: string,
  widthMm: number,
  heightMm: number,
  spec: SheetLabelSpec,
): LabelFormat {
  return { key, label, kind: 'sheet', widthMm, heightMm, sheet: spec };
}

/**
 * Nejběžnější formáty. Niimbot: role pro B1 (šířka 20–50 mm); 50 × 30 je
 * ověřený, ostatní jsou spočítané z DPI. A4: standardní archy (Avery/Herma).
 */
export const LABEL_FORMATS: LabelFormat[] = [
  niimbot(50, 30, true),
  niimbot(40, 30),
  niimbot(50, 50),
  niimbot(40, 20),
  niimbot(30, 20),
  niimbot(30, 15),
  sheet('a4-3x8', 'Arch A4 – 24 ks (70 × 37 mm)', 70, 37, {
    cols: 3,
    rows: 8,
    marginTopMm: 0.5,
    marginLeftMm: 0,
    gapXMm: 0,
    gapYMm: 0,
  }),
  sheet('a4-3x7', 'Arch A4 – 21 ks (70 × 42,3 mm)', 70, 42.3, {
    cols: 3,
    rows: 7,
    marginTopMm: 0.4,
    marginLeftMm: 0,
    gapXMm: 0,
    gapYMm: 0,
  }),
  sheet('a4-2x7', 'Arch A4 – 14 ks (99,1 × 38,1 mm)', 99.1, 38.1, {
    cols: 2,
    rows: 7,
    marginTopMm: 15.15,
    marginLeftMm: 4.65,
    gapXMm: 2.5,
    gapYMm: 0,
  }),
  sheet('a4-4x10', 'Arch A4 – 40 ks (48,5 × 25,4 mm)', 48.5, 25.4, {
    cols: 4,
    rows: 10,
    marginTopMm: 21.5,
    marginLeftMm: 8,
    gapXMm: 0,
    gapYMm: 0,
  }),
  sheet('a4-5x13', 'Arch A4 – 65 ks (38 × 21,2 mm)', 38, 21.2, {
    cols: 5,
    rows: 13,
    marginTopMm: 10.7,
    marginLeftMm: 4.75,
    gapXMm: 2.5,
    gapYMm: 0,
  }),
];

export const DEFAULT_LABEL_FORMAT = 'niimbot-50x30';

export function findLabelFormat(key: string | null | undefined): LabelFormat | undefined {
  return LABEL_FORMATS.find((f) => f.key === key);
}

/**
 * Výchozí šablona formátu: název, kód, kategorie (jako dosavadní pevný štítek).
 * Na nízkých štítcích (≤ 20 mm) jen název a kód, ať zůstane čitelné písmo.
 */
export function defaultLabelTemplate(formatKey: string): LabelTemplate {
  const format = findLabelFormat(formatKey);
  const low = (format?.heightMm ?? 30) <= 20;
  const cells: LabelCell[] = [
    { id: 'name', kind: 'name', size: 'L', bold: true, maxLines: low ? 2 : 3 },
    { id: 'code', kind: 'code', size: 'M', bold: true, maxLines: 1 },
  ];
  if (!low) cells.push({ id: 'category', kind: 'category', size: 'S', bold: false, maxLines: 1 });
  return { formatKey, cells };
}

/**
 * Ověří a normalizuje buňky šablony (API před uložením, web po načtení).
 * Vyhodí `Error` s českou hláškou, když šablona nedává smysl.
 */
export function normalizeLabelCells(input: unknown): LabelCell[] {
  if (!Array.isArray(input)) throw new Error('Buňky šablony musí být pole.');
  if (input.length > LABEL_MAX_CELLS) throw new Error(`Šablona může mít max. ${LABEL_MAX_CELLS} buněk.`);
  const seen = new Set<string>();
  const ids = new Set<string>();
  return input.map((raw, i) => {
    const c = (raw ?? {}) as Partial<LabelCell>;
    const kind = c.kind as LabelCellKind;
    if (!(kind in LABEL_CELL_LABELS)) throw new Error(`Neznámý typ buňky (${String(c.kind)}).`);
    if (kind !== 'custom') {
      if (seen.has(kind)) throw new Error(`Buňka „${LABEL_CELL_LABELS[kind]}“ je v šabloně dvakrát.`);
      seen.add(kind);
    }
    const text = kind === 'custom' ? String(c.text ?? '').trim() : undefined;
    if (kind === 'custom' && !text) throw new Error('Vlastní text nesmí být prázdný.');
    if (text && text.length > LABEL_CUSTOM_TEXT_MAX) {
      throw new Error(`Vlastní text může mít max. ${LABEL_CUSTOM_TEXT_MAX} znaků.`);
    }
    let id = typeof c.id === 'string' && /^[\w-]{1,40}$/.test(c.id) ? c.id : `cell-${i}`;
    while (ids.has(id)) id = `${id}-${i}`;
    ids.add(id);
    const size: LabelCellSize = c.size === 'S' || c.size === 'L' ? c.size : 'M';
    const maxLines = c.maxLines === 2 || c.maxLines === 3 ? c.maxLines : 1;
    return { id, kind, ...(text ? { text } : {}), size, bold: c.bold === true, maxLines };
  });
}
