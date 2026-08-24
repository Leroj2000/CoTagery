/**
 * Sestaví český platební řetězec **SPAYD** (Short Payment Descriptor) pro QR
 * platbu (EPIC-19 F3, Adapter A). Formát: `SPD*1.0*ACC:<IBAN>*AM:<částka>*CC:<měna>
 * *X-VS:<VS>*MSG:<zpráva>`. Pole se oddělují `*`, hodnoty nesmí `*` obsahovat.
 */
export interface SpaydParams {
  iban: string;
  amount: string | number;
  currency: string;
  vs?: string | number | null;
  message?: string | null;
}

/** Odstraní `*` a diakritiku, ořízne délku (SPAYD hodnoty jsou ASCII, MSG ≤ 60). */
function sanitize(value: string, max: number): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function buildSpayd(p: SpaydParams): string {
  const iban = p.iban.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}[0-9A-Z]{13,32}$/.test(iban)) {
    throw new Error('invalid_iban');
  }
  const amount = (Math.round(Number(p.amount) * 100) / 100).toFixed(2);
  const fields = [`ACC:${iban}`, `AM:${amount}`, `CC:${p.currency.toUpperCase()}`];
  if (p.vs != null && String(p.vs).trim() !== '') {
    fields.push(`X-VS:${String(p.vs).replace(/\D/g, '').slice(0, 10)}`);
  }
  if (p.message) {
    const msg = sanitize(p.message, 60);
    if (msg) fields.push(`MSG:${msg}`);
  }
  return `SPD*1.0*${fields.join('*')}`;
}
