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
    let userId: string;
    const existingUser = await dataSource.query(
      `SELECT id FROM users WHERE tenant_id = $1 AND email = $2`,
      [tenantId, email],
    );
    if (existingUser.length > 0) {
      userId = existingUser[0].id;
      console.log('Demo uživatel už existuje:', userId);
    } else {
      const passwordHash = await AuthService.hashPassword('demo1234');
      const inserted = await dataSource.query(
        `INSERT INTO users (tenant_id, email, name, password_hash, tenant_role)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [tenantId, email, 'Demo Owner', passwordHash, 'OWNER'],
      );
      userId = inserted[0].id;
      console.log('Vytvořen demo uživatel:', userId, `(${email} / demo1234)`);
    }

    // EPIC-18: členství identity v organizaci + role_assignment (idempotentně).
    const m = await dataSource.query(
      `INSERT INTO org_memberships (tenant_id, user_id, role, status)
       VALUES ($1, $2, 'OWNER', 'active')
       ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = EXCLUDED.role
       RETURNING id`,
      [tenantId, userId],
    );
    await dataSource.query(
      `INSERT INTO role_assignments (tenant_id, membership_id, role_key, scope_type)
       SELECT $1, $2, 'OWNER', 'ORGANIZATION'
       WHERE NOT EXISTS (SELECT 1 FROM role_assignments WHERE membership_id = $2)`,
      [tenantId, m[0].id],
    );
  } finally {
    await dataSource.destroy();
  }
}

seed().catch((err) => {
  console.error('Seed selhal:', err);
  process.exit(1);
});
