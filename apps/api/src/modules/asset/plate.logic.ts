/**
 * SPZ (registrační značka): velká písmena, mezery sjednocené, bez okrajových.
 * „1ab  2345" → „1AB 2345". Prázdné = null. Formát se nevaliduje (zahraniční,
 * historické a speciální značky).
 */
export function normalizePlate(raw: string | null | undefined): string | null {
  const v = (raw ?? '').replace(/\s+/g, ' ').trim().toUpperCase();
  return v || null;
}
