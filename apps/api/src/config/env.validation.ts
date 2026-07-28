import { z } from 'zod';

/** Schéma proměnných prostředí. Validuje se při startu (ADR: fail-fast konfigurace). */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  STORAGE_DRIVER: z.enum(['local', 'r2', 's3']).default('local'),
  STORAGE_LOCAL_PATH: z.string().default('./.storage'),
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
