import type { ValueTransformer } from 'typeorm';

/** PostgreSQL numeric is returned as text; meter values use at most one decimal. */
export const meterNumberTransformer: ValueTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value == null ? null : Number(value)),
};
