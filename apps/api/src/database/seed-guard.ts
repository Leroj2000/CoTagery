/**
 * Demo seedy (známé heslo `owner@demo.tagery`) nesmí běžet v produkci (BACKLOG SEC-03).
 * Migrační kontejner je spouští při každém nasazení; v `NODE_ENV=production` se
 * přeskočí, pokud je výslovně nepovolí `SEED_DEMO=1` (např. izolovaný smoke stack).
 */
export function shouldSkipDemoSeed(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === 'production' && env.SEED_DEMO !== '1';
}
