import { validateEnv } from './env.validation';

const base = {
  DATABASE_URL: 'postgres://owner:secret@localhost:5432/tagery',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: 'a-secure-test-secret',
};

describe('production environment validation', () => {
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
        ...base,
        NODE_ENV: 'production',
        APP_DATABASE_URL: 'postgres://app:secret@localhost:5432/tagery',
        CORS_ORIGINS: 'https://app.tagery.example',
      }).APP_DATABASE_URL,
    ).toContain('app:secret');
  });
});
