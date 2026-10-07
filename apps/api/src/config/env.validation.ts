import { z } from 'zod';

/** Schéma proměnných prostředí. Validuje se při startu (ADR: fail-fast konfigurace). */
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    API_PORT: z.coerce.number().int().positive().default(3001),
    DATABASE_URL: z.string().url(),
    // Runtime spojení aplikace (ne-superuser role podléhající RLS – ADR-0001).
    // Když není nastaveno, použije se DATABASE_URL (pozor: superuser obchází RLS).
    APP_DATABASE_URL: z.string().url().optional(),
    // Čárkou oddělené přesné originy. Wildcard se v produkci nepovoluje.
    CORS_ORIGINS: z.string().default('http://localhost:3000'),
    REDIS_URL: z.string().url(),
    STORAGE_DRIVER: z.enum(['local', 'r2', 's3']).default('local'),
    STORAGE_LOCAL_PATH: z.string().default('./.storage'),
    JWT_SECRET: z.string().min(16),
    JWT_ACCESS_TTL: z.string().default('15m'),
    JWT_REFRESH_TTL: z.string().default('30d'),
    // Veřejná základní URL pro resolver (do QR/NFC nosičů) – ADR-0002.
    PUBLIC_BASE_URL: z.string().url().default('http://localhost:3001'),
    // Veřejná URL webu (pro odkaz v e-mailu na reset hesla).
    PUBLIC_WEB_URL: z.string().url().default('http://localhost:3000'),
    // Volitelný webhook pro odeslání e-mailu (např. n8n). Když prázdné, odkaz se
    // jen zaloguje (dev fallback) – reset flow funguje i tak (testovatelný z logu).
    PASSWORD_RESET_WEBHOOK_URL: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().url().optional(),
    ),
    // SMTP pro odchozí e-maily (reset hesla). Když nevyplněno, e-mail se neposílá
    // (odkaz se jen loguje / jde na webhook).
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.string().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASSWORD: z.string().optional(),
    SMTP_FROM: z.string().optional(),
    // Sdílené tajemství pro ověření podpisu PSP webhooků (EPIC-17, stub PSP).
    BILLING_WEBHOOK_SECRET: z.string().min(8).default('whsec_stub'),
    // Volitelný webhook (n8n) pro AI stažení manuálu k položce. Když prázdné,
    // endpoint fetch-ai vrátí „není nakonfigurováno" – upload/kamera fungují dál.
    MANUAL_FETCH_WEBHOOK_URL: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().url().optional(),
    ),
    // Volitelné sdílené tajemství pro podpis webhooku i ověření callbacku (HMAC).
    MANUAL_FETCH_WEBHOOK_SECRET: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().optional(),
    ),
    // Základ URL, na kterou n8n zavolá callback. Když API a n8n běží v oddělených
    // docker stacích, nastav interní adresu API (např. http://tagery-api-1:3001);
    // jinak se použije PUBLIC_BASE_URL.
    MANUAL_CALLBACK_BASE_URL: z.preprocess(
      (v) => (v === '' ? undefined : v),
      z.string().url().optional(),
    ),
    // Nominatim-kompatibilní endpoint pro GPS → adresa; musí jít změnit bez releasu.
    GEOCODING_REVERSE_URL: z.string().url().default('https://nominatim.openstreetmap.org/reverse'),
    GEOCODING_USER_AGENT: z.string().min(3).default('Tagery/0.1'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && !env.APP_DATABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['APP_DATABASE_URL'],
        message: 'V produkci je povinné runtime DB spojení pod rolí podléhající RLS',
      });
    }
    if (
      env.NODE_ENV === 'production' &&
      env.CORS_ORIGINS.split(',').some((origin) => origin.trim() === '*')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CORS_ORIGINS'],
        message: 'Produkční CORS nesmí obsahovat wildcard',
      });
    }
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
