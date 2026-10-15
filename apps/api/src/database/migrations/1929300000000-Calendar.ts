import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Kalendář firmy:
 * - `calendar_events` (RLS) – ručně založené události; ostatní položky kalendáře
 *   se skládají za běhu z existující evidence (rezervace, servis, záruky…),
 * - `calendar_shares` (RLS) – veřejné odkazy na kalendář jen pro čtení. Ukládá se
 *   jen SHA-256 hash tokenu; odkaz jde zneplatnit (`revoked_at`) a může vypršet,
 * - `calendar_share_lookup` – SECURITY DEFINER pro veřejný endpoint bez tenant
 *   kontextu (obdoba `activation_lookup`), vrací jen platný odkaz,
 * - oprávnění `core.calendar.*` (view/create/update/delete + manage = sdílení).
 */
export class Calendar1929300000000 implements MigrationInterface {
  name = 'Calendar1929300000000';

  private readonly tables = ['calendar_events', 'calendar_shares'];

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE calendar_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      title text NOT NULL,
      description text,
      location text,
      starts_at timestamptz NOT NULL,
      ends_at timestamptz,
      all_day boolean NOT NULL DEFAULT false,
      created_by uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CHECK (ends_at IS NULL OR ends_at >= starts_at))`);
    await q.query(
      `CREATE INDEX ix_calendar_events_range ON calendar_events (tenant_id, starts_at)`,
    );

    await q.query(`CREATE TABLE calendar_shares (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      token_hash text NOT NULL UNIQUE,
      label text,
      sources text[] NOT NULL DEFAULT '{event}',
      expires_at timestamptz,
      revoked_at timestamptz,
      last_accessed_at timestamptz,
      created_by uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now())`);
    await q.query(`CREATE INDEX ix_calendar_shares_tenant ON calendar_shares (tenant_id)`);

    for (const t of this.tables) {
      await q.query(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`);
      await q.query(`ALTER TABLE ${t} FORCE ROW LEVEL SECURITY`);
      await q.query(`CREATE POLICY tenant_isolation ON ${t}
        USING (tenant_id = current_setting('app.tenant_id',true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.tenant_id',true)::uuid)`);
      await q.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ${t} TO tagery_app`);
    }

    await q.query(`
      CREATE OR REPLACE FUNCTION calendar_share_lookup(p_token_hash text)
      RETURNS TABLE (share_id uuid, tenant_id uuid, label text, sources text[])
      LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
        SELECT s.id, s.tenant_id, s.label, s.sources
        FROM calendar_shares s
        WHERE s.token_hash = p_token_hash
          AND s.revoked_at IS NULL
          AND (s.expires_at IS NULL OR s.expires_at > now())
      $$;
    `);
    await q.query(`REVOKE ALL ON FUNCTION calendar_share_lookup(text) FROM PUBLIC`);
    await q.query(`GRANT EXECUTE ON FUNCTION calendar_share_lookup(text) TO tagery_app`);

    await q.query(`
      INSERT INTO permissions (key, module_key, resource, action, sensitivity) VALUES
        ('core.calendar.view', 'core', 'calendar', 'view', 'normal'),
        ('core.calendar.create', 'core', 'calendar', 'create', 'normal'),
        ('core.calendar.update', 'core', 'calendar', 'update', 'normal'),
        ('core.calendar.delete', 'core', 'calendar', 'delete', 'normal'),
        ('core.calendar.manage', 'core', 'calendar', 'manage', 'high')
      ON CONFLICT (key) DO NOTHING`);
    // Systémové šablony (owner/admin mají vše implicitně). Upravené kopie firem je
    // nedostanou automaticky (ADR 0013) – zapne je vlastník v matici rolí.
    await q.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id FROM roles r JOIN permissions p
        ON (r.key IN ('viewer', 'editor', 'manager') AND p.key = 'core.calendar.view')
        OR (r.key IN ('editor', 'manager')
            AND p.key IN ('core.calendar.create', 'core.calendar.update', 'core.calendar.delete'))
        OR (r.key = 'manager' AND p.key = 'core.calendar.manage')
      WHERE r.tenant_id IS NULL
      ON CONFLICT DO NOTHING`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DELETE FROM permissions WHERE key LIKE 'core.calendar.%'`);
    await q.query(`DROP FUNCTION IF EXISTS calendar_share_lookup(text)`);
    await q.query(`DROP TABLE calendar_shares`);
    await q.query(`DROP TABLE calendar_events`);
  }
}
