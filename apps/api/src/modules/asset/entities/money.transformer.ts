import type { ValueTransformer } from 'typeorm';

/** PostgreSQL numeric (ceny, sazba DPH) přichází jako text – převod na číslo. */
export const moneyTransformer: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value == null ? null : Number(value)),
};
