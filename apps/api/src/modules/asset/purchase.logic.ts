/**
 * Pořízení a záruky položky – čistá logika (bez DB), sdílená API i testy.
 *
 * Ceny: ukládá se cena bez DPH, sazba i cena s DPH (zaokrouhleno na haléře),
 * aby se historické údaje nerozjely změnou sazby. Plátce DPH zadává typicky
 * cenu bez DPH, neplátce cenu s DPH (DPH je pro něj náklad).
 *
 * Záruky: začátek, délka v měsících nebo přímo datum konce. Data jsou
 * `YYYY-MM-DD` (bez času). Začátek se odvozuje z pořízení podle „základu":
 * - `purchase` – od data pořízení (zákonná záruka prodejce běží od převzetí),
 * - `in_service` – od prvního uvedení do provozu (zbytek záruky výrobce
 *   u použité věci, kotle a stroje se zárukou od zprovoznění),
 * - `custom` – ručně zadané datum.
 * Při změně dat pořízení se záruky s odvozeným začátkem přepočítají.
 */

/** Výchozí sazba DPH (ČR, základní). */
export const DEFAULT_VAT_RATE = 21;
/** Za kolik dní před koncem se záruka hlásí ve „Vyžaduje pozornost". */
export const WARRANTY_EXPIRING_DAYS = 30;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface PriceInput {
  /** Zadaná částka. */
  amount: number | null;
  /** Je zadaná částka včetně DPH? */
  includesVat: boolean;
  /** Sazba v %, null = neuvedeno (neplátce bez rozpisu DPH). */
  vatRate: number | null;
}

export interface PriceBreakdown {
  priceNet: number | null;
  vatRate: number | null;
  priceGross: number | null;
}

const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

/** Dopočítá cenu bez/s DPH ze zadané částky a sazby. */
export function computePrice(input: PriceInput): PriceBreakdown {
  if (input.amount == null || !Number.isFinite(input.amount)) {
    return { priceNet: null, vatRate: input.vatRate, priceGross: null };
  }
  const amount = round2(input.amount);
  if (input.vatRate == null) {
    // Bez sazby nejde druhou cenu dopočítat – známe jen tu zadanou.
    return input.includesVat
      ? { priceNet: null, vatRate: null, priceGross: amount }
      : { priceNet: amount, vatRate: null, priceGross: null };
  }
  const factor = 1 + input.vatRate / 100;
  return input.includesVat
    ? { priceNet: round2(amount / factor), vatRate: input.vatRate, priceGross: amount }
    : { priceNet: amount, vatRate: input.vatRate, priceGross: round2(amount * factor) };
}

export type PurchaseCondition = 'new' | 'used';
export type WarrantyStartBasis = 'purchase' | 'in_service' | 'custom';
export const WARRANTY_START_BASES: WarrantyStartBasis[] = ['purchase', 'in_service', 'custom'];

/** Data pořízení potřebná k odvození začátku záruky. */
export interface PurchaseDates {
  condition: PurchaseCondition;
  purchasedOn: string | null;
  /** První uvedení do provozu (u použité věci typicky u předchozího majitele). */
  inServiceOn: string | null;
}

/**
 * Datum uvedení do provozu: zadané, u nové věci jinak datum pořízení. U použité
 * se z data pořízení odvodit nedá (věc už předtím někdo používal).
 */
export function effectiveInService(p: PurchaseDates | null): string | null {
  if (!p) return null;
  return p.inServiceOn ?? (p.condition === 'new' ? p.purchasedOn : null);
}

/** Začátek záruky podle základu; `null` = z pořízení nejde určit (nebo `custom`). */
export function warrantyStartFor(
  basis: WarrantyStartBasis,
  p: PurchaseDates | null,
): string | null {
  if (basis === 'purchase') return p?.purchasedOn ?? null;
  if (basis === 'in_service') return effectiveInService(p);
  return null;
}

/**
 * Výchozí základ nové záruky: u použité věci se známým uvedením do provozu
 * zbytek záruky výrobce, jinak od pořízení.
 */
export function defaultStartBasis(p: PurchaseDates | null): WarrantyStartBasis {
  return p?.condition === 'used' && p.inServiceOn ? 'in_service' : 'purchase';
}

/**
 * Přepočet záruky po změně dat pořízení. Vrací nové `startsOn`/`endsOn`, nebo
 * `null`, když se nic nemění (ruční začátek, chybějící datum, nebo by pevně
 * zadaný konec vyšel před začátek).
 */
export function rebaseWarranty(
  w: {
    startBasis: WarrantyStartBasis;
    startsOn: string | null;
    months: number | null;
    endsOn: string;
  },
  p: PurchaseDates | null,
): { startsOn: string; endsOn: string } | null {
  if (w.startBasis === 'custom') return null;
  const startsOn = warrantyStartFor(w.startBasis, p);
  if (!startsOn) return null;
  const endsOn = w.months ? addMonths(startsOn, w.months) : w.endsOn;
  if (endsOn < startsOn) return null;
  if (startsOn === w.startsOn && endsOn === w.endsOn) return null;
  return { startsOn, endsOn };
}

export function isIsoDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Přičte měsíce k datu; konec měsíce se zarovná (31. 1. + 1 = 28./29. 2.). */
export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const targetMonth = m - 1 + months;
  const year = y + Math.floor(targetMonth / 12);
  const month = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Datum konce záruky: zadané, jinak začátek + měsíce. */
export function warrantyEnd(input: {
  startsOn: string | null;
  months: number | null;
  endsOn: string | null;
}): string | null {
  if (input.endsOn) return input.endsOn;
  if (input.startsOn && input.months != null && input.months > 0) {
    return addMonths(input.startsOn, input.months);
  }
  return null;
}

export type WarrantyStatus = 'active' | 'expiring' | 'expired';

/** Stav záruky k datu `today` (YYYY-MM-DD). Poslední den záruky ještě platí. */
export function warrantyStatus(
  endsOn: string,
  today: string,
  expiringDays = WARRANTY_EXPIRING_DAYS,
): WarrantyStatus {
  if (endsOn < today) return 'expired';
  const limit = addDays(today, expiringDays);
  return endsOn <= limit ? 'expiring' : 'active';
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Dnešní datum v Praze (záruka je kalendářní, ne UTC). */
export function todayInPrague(now = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Prague' }).format(now);
}

/** Číslo z nastavení firmy (`settings.defaultVatRate`), jinak výchozí 21 %. */
export function tenantVatRate(settings: Record<string, unknown> | null | undefined): number {
  const v = Number(settings?.defaultVatRate);
  return Number.isFinite(v) && v >= 0 && v <= 100 ? v : DEFAULT_VAT_RATE;
}

export function tenantIsVatPayer(settings: Record<string, unknown> | null | undefined): boolean {
  return settings?.vatPayer === true;
}

/**
 * Název souboru z multipartu: busboy ho podle verze dodá jako latin1 bajty
 * UTF-8 (např. „Ã¡" místo „á") – opravíme jen tehdy, když dekódování dává platné UTF-8.
 */
export function decodeFileName(name: string): string {
  if ([...name].some((ch) => ch.charCodeAt(0) > 0xff)) return name;
  const utf8 = Buffer.from(name, 'latin1').toString('utf8');
  return utf8.includes('\uFFFD') ? name : utf8;
}
