/** Ceník inzerátu potřebný pro výpočet nabídky (podmnožina RentalListing). */
export interface QuoteListing {
  pricePerDay: string;
  depositAmount: string;
  currency: string;
  minDays: number;
  maxDays: number | null;
}

export interface Quote {
  days: number;
  rentAmount: string;
  depositAmount: string;
  total: string;
  currency: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Zaokrouhlí na 2 desetinná místa a vrátí jako string (numeric-friendly). */
function money(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

/**
 * Spočítá závaznou nabídku pro objednávku (EPIC-19 F2). Server-side autoritativní
 * (nájemce posílá jen období). Počet dní = zaokrouhleno nahoru na celé dny,
 * minimálně `minDays`. Vyhodí Error s kódem při neplatném období/době.
 */
export function computeQuote(listing: QuoteListing, start: Date, end: Date): Quote {
  const startMs = start.getTime();
  const endMs = end.getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
    throw new Error('invalid_period');
  }
  if (endMs <= startMs) throw new Error('invalid_period');

  const rawDays = Math.ceil((endMs - startMs) / DAY_MS);
  const minDays = Math.max(1, listing.minDays || 1);
  const days = Math.max(rawDays, minDays);

  if (rawDays < minDays) throw new Error('below_min_days');
  if (listing.maxDays != null && rawDays > listing.maxDays) throw new Error('above_max_days');

  const pricePerDay = Number(listing.pricePerDay) || 0;
  const deposit = Number(listing.depositAmount) || 0;
  const rent = pricePerDay * days;

  return {
    days,
    rentAmount: money(rent),
    depositAmount: money(deposit),
    total: money(rent + deposit),
    currency: listing.currency || 'CZK',
  };
}
