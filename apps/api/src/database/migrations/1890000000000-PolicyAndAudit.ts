import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * EPIC-18 Fáze 4 – policy engine (MVP: časové okno na členství) + audit_events.
 * Vše tenant-scoped, RLS. Policy se vyhodnocuje v interceptoru (request-level
 * gate). Audit zaznamenává citlivé změny (role/entitlement/členové) s before/after.
 */
export class PolicyAndAudit1890000000000 implements MigrationInterface {
  name = 'PolicyAndAudit1890000000000';

  private async rls(q: QueryRunner, table: string, grant: string): Promise<void> {
    await q.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
    await q.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
    await q.query(`
      CREATE POLICY "tenant_isolation" ON "${table}"
      USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
    `);
    await q.query(`GRANT ${grant} ON "${table}" TO "tagery_app"`);
  }

  public async up(q: QueryRunner): Promise<void> {
    // --- audit_events ---
    await q.query(`
      CREATE TABLE IF NOT EXISTS "audit_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "actor_user_id" uuid,
        "action" text NOT NULL,
        "target_type" text,
        "target_id" text,
        "before" jsonb,
        "after" jsonb,
        "context" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(
      `CREATE INDEX IF NOT EXISTS "ix_audit_events_tenant_time" ON "audit_events" ("tenant_id", "created_at" DESC)`,
    );
    await this.rls(q, 'audit_events', 'SELECT, INSERT');

    // --- policies ---
    await q.query(`
      CREATE TABLE IF NOT EXISTS "policies" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "type" text NOT NULL,
        "config_json" jsonb NOT NULL DEFAULT '{}',
        "status" text NOT NULL DEFAULT 'active',
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await this.rls(q, 'policies', 'SELECT, INSERT, UPDATE, DELETE');

    // --- policy_assignments ---
    await q.query(`
      CREATE TABLE IF NOT EXISTS "policy_assignments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "policy_id" uuid NOT NULL REFERENCES "policies"("id") ON DELETE CASCADE,
        "subject_type" text NOT NULL,
        "subject_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(
      `CREATE INDEX IF NOT EXISTS "ix_policy_assignments_subject" ON "policy_assignments" ("subject_type", "subject_id")`,
    );
    await this.rls(q, 'policy_assignments', 'SELECT, INSERT, DELETE');
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE IF EXISTS "policy_assignments"`);
    await q.query(`DROP TABLE IF EXISTS "policies"`);
    await q.query(`DROP TABLE IF EXISTS "audit_events"`);
  }
}
