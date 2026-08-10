import { z } from 'zod';

/** Schéma proměnných prostředí. Validuje se při startu (ADR: fail-fast konfigurace). */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url(),
  // Runtime spojení aplikace (ne-superuser role podléhající RLS – ADR-0001).
  // Když není nastaveno, použije se DATABASE_URL (pozor: superuser obchází RLS).
  APP_DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().url(),
  STORAGE_DRIVER: z.enum(['local', 'r2', 's3']).default('local'),
  STORAGE_LOCAL_PATH: z.string().default('./.storage'),
  JWT_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  // Veřejná základní URL pro resolver (do QR/NFC nosičů) – ADR-0002.
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:3001'),
  // Sdílené tajemství pro ověření podpisu PSP webhooků (EPIC-17, stub PSP).
  BILLING_WEBHOOK_SECRET: z.string().min(8).default('whsec_stub'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const details = JSON.stringify(parsed.error.format(), null, 2);
    throw new Error(`Neplatná konfigurace prostředí:\n${details}`);
  }
  return parsed.data;
}
