import pg from 'pg';

const url = process.env.APP_DATABASE_URL;
if (!url) throw new Error('Pro RLS test nastavte APP_DATABASE_URL');

const client = new pg.Client({ connectionString: url });
await client.connect();

try {
  const tenants = await client.query('SELECT id FROM tenants ORDER BY id LIMIT 2');
  if (tenants.rowCount < 2) throw new Error('RLS test vyžaduje alespoň dva tenanty');
  const [tenantA, tenantB] = tenants.rows.map((row) => row.id);

  const tables = await client.query(`
    SELECT c.relname AS name, c.relrowsecurity AS enabled,
           EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid) AS has_policy
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind = 'r'
       AND EXISTS (
         SELECT 1 FROM pg_attribute a
          WHERE a.attrelid = c.oid AND a.attname = 'tenant_id' AND NOT a.attisdropped
       )
     ORDER BY c.relname
  `);

  // Identity/session and renter-follow tables use explicit subject scoping instead of app.tenant_id.
  const explicitScope = new Set([
    'users',
    'refresh_tokens',
    'account_action_tokens',
    'network_follows',
  ]);
  const failures = [];

  for (const table of tables.rows) {
    if (explicitScope.has(table.name)) continue;
    if (!table.enabled || !table.has_policy) {
      failures.push(`${table.name}: RLS nebo policy není zapnutá`);
      continue;
    }

    await client.query('BEGIN');
    try {
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantA]);
      const foreignRead = await client.query(
        `SELECT count(*)::int AS count FROM ${pg.escapeIdentifier(table.name)} WHERE tenant_id = $1`,
        [tenantB],
      );
      if (foreignRead.rows[0].count !== 0) failures.push(`${table.name}: čte cizí tenant`);

      try {
        const foreignWrite = await client.query(
          `UPDATE ${pg.escapeIdentifier(table.name)} SET tenant_id = tenant_id WHERE tenant_id = $1`,
          [tenantB],
        );
        if (foreignWrite.rowCount !== 0) failures.push(`${table.name}: mění cizí tenant`);
      } catch (error) {
        // Chybějící UPDATE grant je stejně bezpečný výsledek.
        if (error?.code !== '42501') throw error;
      }
    } finally {
      await client.query('ROLLBACK');
    }
  }

  const definerFunctions = await client.query(`
    SELECT p.proname AS name, p.proconfig
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prosecdef
  `);
  for (const fn of definerFunctions.rows) {
    if (!(fn.proconfig ?? []).includes('search_path=public')) {
      failures.push(`${fn.name}: SECURITY DEFINER nemá fixní search_path`);
    }
  }

  if (failures.length) throw new Error(`RLS audit selhal:\n- ${failures.join('\n- ')}`);
  console.log(
    `RLS audit prošel: ${tables.rowCount - explicitScope.size} tenantových tabulek, ${definerFunctions.rowCount} SECURITY DEFINER funkcí.`,
  );
} finally {
  await client.end();
}
