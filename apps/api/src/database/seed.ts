import dataSource from '../core/database/data-source';

/** Seed (EPIC-00): založí demo tenant, pokud ještě neexistuje. */
async function seed(): Promise<void> {
  await dataSource.initialize();
  try {
    const existing = await dataSource.query(`SELECT id FROM tenants WHERE name = $1`, ['Demo Tenant']);
    if (existing.length > 0) {
      console.log('Demo tenant už existuje:', existing[0].id);
      return;
    }
    const inserted = await dataSource.query(
      `INSERT INTO tenants (name, type) VALUES ($1, $2) RETURNING id`,
      ['Demo Tenant', 'mixed'],
    );
    console.log('Vytvořen demo tenant:', inserted[0].id);
  } finally {
    await dataSource.destroy();
  }
}

seed().catch((err) => {
  console.error('Seed selhal:', err);
  process.exit(1);
});
