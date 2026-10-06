import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ProductWorkflows1927000000000 implements MigrationInterface {
  name = 'ProductWorkflows1927000000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE operation_receipts (
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      request_id uuid NOT NULL, actor_id uuid NOT NULL REFERENCES users(id),
      kind text NOT NULL, payload_hash text NOT NULL, result jsonb NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(tenant_id,request_id))`);
    await q.query(`CREATE TABLE asset_handoffs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      asset_id uuid NOT NULL REFERENCES assets(id), from_person_id uuid NOT NULL REFERENCES people(id),
      to_person_id uuid NOT NULL REFERENCES people(id), prepared_by uuid NOT NULL REFERENCES users(id),
      status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','cancelled','rejected')),
      note text, created_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz,
      completed_by uuid REFERENCES users(id))`);
    await q.query(`CREATE UNIQUE INDEX handoff_one_pending ON asset_handoffs(tenant_id,asset_id) WHERE status='pending'`);
    await q.query(`CREATE TABLE asset_self_loans (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      asset_id uuid NOT NULL REFERENCES assets(id), person_id uuid NOT NULL REFERENCES people(id),
      requested_by uuid NOT NULL REFERENCES users(id), status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
      movement_id uuid NOT NULL REFERENCES asset_movements(id), created_at timestamptz NOT NULL DEFAULT now(),
      decided_at timestamptz, decided_by uuid REFERENCES users(id))`);
    for (const table of ['operation_receipts', 'asset_handoffs', 'asset_self_loans']) {
      await q.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await q.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
      await q.query(`CREATE POLICY tenant_isolation ON ${table} USING (tenant_id = current_setting('app.tenant_id',true)::uuid) WITH CHECK (tenant_id = current_setting('app.tenant_id',true)::uuid)`);
      await q.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ${table} TO tagery_app`);
    }
    await q.query(`INSERT INTO permissions(key,module_key,resource,action,sensitivity) VALUES
      ('asset.selfloan.use','asset','selfloan','use','normal'),
      ('asset.handoff.use','asset','handoff','use','normal') ON CONFLICT DO NOTHING`);
    await q.query(`INSERT INTO role_permissions(role_id,permission_id)
      SELECT r.id,p.id FROM roles r CROSS JOIN permissions p WHERE r.tenant_id IS NULL
      AND p.key IN ('asset.selfloan.use','asset.handoff.use') ON CONFLICT DO NOTHING`);
  }
  async down(q: QueryRunner): Promise<void> {
    for (const table of ['asset_self_loans','asset_handoffs','operation_receipts']) await q.query(`DROP TABLE ${table}`);
    await q.query(`DELETE FROM permissions WHERE key IN ('asset.selfloan.use','asset.handoff.use')`);
  }
}
