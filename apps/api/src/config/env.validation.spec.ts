import { validateEnv } from './env.validation';

const base = {
  DATABASE_URL: 'postgres://owner:secret@localhost:5432/tagery',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'a-secure-test-secret',
};

const prodSecrets = {
  ...base,
  JWT_SECRET: 'x'.repeat(40),
  BILLING_WEBHOOK_SECRET: 'whsec_' + 'y'.repeat(32),
};

describe('production environment validation', () => {
  it('rejects the default billing webhook secret in production (SEC-03)', () => {
    expect(() =>
      validateEnv({
        ...prodSecrets,
        BILLING_WEBHOOK_SECRET: undefined,
        NODE_ENV: 'production',
        APP_DATABASE_URL: 'postgres://app:secret@localhost:5432/tagery',
      }),
    ).toThrow('BILLING_WEBHOOK_SECRET');
  });

  it('rejects a short JWT secret in production (SEC-03)', () => {
    expect(() =>
      validateEnv({
        ...prodSecrets,
        JWT_SECRET: 'a-secure-test-secret',
        NODE_ENV: 'production',
        APP_DATABASE_URL: 'postgres://app:secret@localhost:5432/tagery',
      }),
    ).toThrow('JWT_SECRET');
  });

  it('keeps defaults usable outside production', () => {
    expect(validateEnv({ ...base }).BILLING_WEBHOOK_SECRET).toBe('whsec_stub');
  });

  it('requires the RLS application connection', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: 'production' })).toThrow('APP_DATABASE_URL');
  });

  it('rejects wildcard CORS in production', () => {
    expect(() =>
      validateEnv({
        ...base,
        NODE_ENV: 'production',
        APP_DATABASE_URL: 'postgres://app:secret@localhost:5432/tagery',
        CORS_ORIGINS: '*',
      }),
    ).toThrow('CORS_ORIGINS');
  });

  it('accepts an explicit origin and RLS connection', () => {
    expect(
      validateEnv({
        ...prodSecrets,
        NODE_ENV: 'production',
        APP_DATABASE_URL: 'postgres://app:secret@localhost:5432/tagery',
        CORS_ORIGINS: 'https://app.tagery.example',
      }).APP_DATABASE_URL,
    ).toContain('app:secret');
  });

  it('validates the reverse geocoding endpoint', () => {
    expect(() => validateEnv({ ...base, GEOCODING_REVERSE_URL: 'not-a-url' })).toThrow(
      'GEOCODING_REVERSE_URL',
    );
  });
});
