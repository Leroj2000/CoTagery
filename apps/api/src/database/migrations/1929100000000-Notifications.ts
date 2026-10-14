import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Notifikace (e-mail):
 * - `notification_settings` (RLS) – firma zapíná/vypíná provozní notifikace a
 *   upravuje texty (předmět, tělo); chybí řádek = výchozí z katalogu,
 * - `platform_notification_templates` – texty systémových e-mailů spravované
 *   Tagery (ověření e-mailu, obnovení hesla),
 * - `notification_log` – odeslané / přeskočené / chybné notifikace (historie v UI,
 *   idempotence denních upomínek). Bez RLS: část e-mailů (reset hesla) nemá firmu;
 *   firma čte jen své řádky přes API filtrované `tenant_id` z JWT.
 */
export class Notifications1929100000000 implements MigrationInterface {
  name = 'Notifications1929100000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE notification_settings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      key text NOT NULL,
      enabled boolean,
      subject text,
      body text,
      updated_by uuid,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (tenant_id, key))`);
    await q.query(`ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY`);
    await q.query(`ALTER TABLE notification_settings FORCE ROW LEVEL SECURITY`);
    await q.query(`CREATE POLICY tenant_isolation ON notification_settings
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)`);
    await q.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON notification_settings TO tagery_app`);

    await q.query(`CREATE TABLE platform_notification_templates (
      key text PRIMARY KEY,
      subject text NOT NULL,
      body text NOT NULL,
      updated_by uuid,
      updated_at timestamptz NOT NULL DEFAULT now())`);
    await q.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON platform_notification_templates TO tagery_app`,
    );

    await q.query(`CREATE TABLE notification_log (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
      key text NOT NULL,
      recipient text NOT NULL,
      ref text,
      status text NOT NULL CHECK (status IN ('sent','skipped','failed','test')),
      error text,
      created_at timestamptz NOT NULL DEFAULT now())`);
    await q.query(
      `CREATE INDEX ix_notification_log_tenant ON notification_log (tenant_id, created_at DESC)`,
    );
    await q.query(
      `CREATE INDEX ix_notification_log_ref ON notification_log (tenant_id, key, ref, created_at DESC)`,
    );
    await q.query(`GRANT SELECT, INSERT ON notification_log TO tagery_app`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE notification_log`);
    await q.query(`DROP TABLE platform_notification_templates`);
    await q.query(`DROP TABLE notification_settings`);
  }
}
