export const VERIFICATION_LEVELS = ['none', 'contact', 'document', 'full_kyc'] as const;
export type VerificationLevel = (typeof VERIFICATION_LEVELS)[number];

/** Splňuje `have` alespoň úroveň `need`? */
export function meetsLevel(have: VerificationLevel, need: VerificationLevel): boolean {
  return VERIFICATION_LEVELS.indexOf(have) >= VERIFICATION_LEVELS.indexOf(need);
}

/** Nový klouzavý průměr hodnocení (Uber/Bolt styl, ADR-0005). */
export function rollingAverage(currentAvg: number, count: number, rating: number): number {
  return (currentAvg * count + rating) / (count + 1);
}
