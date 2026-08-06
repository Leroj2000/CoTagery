import dataSource from '../core/database/data-source';
import { AuthService } from '../core/auth/auth.service';

/** Seed: demo tenant + demo OWNER uživatel (EPIC-00 + EPIC-01). */
async function seed(): Promise<void> {
  await dataSource.initialize();
  try {
    // Demo tenant
    let tenantId: string;
    const existingTenant = await dataSource.query(`SELECT id FROM tenants WHERE name = $1`, [
      'Demo Tenant',
    ]);
    if (existingTenant.length > 0) {
      tenantId = existingTenant[0].id;
      console.log('Demo tenant už existuje:', tenantId);
    } else {
      const inserted = await dataSource.query(
        `INSERT INTO tenants (name, type) VALUES ($1, $2) RETURNING id`,
        ['Demo Tenant', 'mixed'],
      );
      tenantId = inserted[0].id;
      console.log('Vytvořen demo tenant:', tenantId);
    }

    // Demo OWNER uživatel
    const email = 'owner@demo.tagery';
    const existingUser = await dataSource.query(
      `SELECT id FROM users WHERE tenant_id = $1 AND email = $2`,
      [tenantId, email],
    );
    if (existingUser.length > 0) {
      console.log('Demo uživatel už existuje:', existingUser[0].id);
    } else {
      const passwordHash = await AuthService.hashPassword('demo1234');
      const inserted = await dataSource.query(
        `INSERT INTO users (tenant_id, email, name, password_hash, tenant_role)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [tenantId, email, 'Demo Owner', passwordHash, 'OWNER'],
      );
      console.log('Vytvořen demo uživatel:', inserted[0].id, `(${email} / demo1234)`);
    }
  } finally {
    await dataSource.destroy();
  }
}

seed().catch((err) => {
  console.error('Seed selhal:', err);
  process.exit(1);
});
