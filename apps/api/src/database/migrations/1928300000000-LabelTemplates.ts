import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Šablony štítků per firma a formát (editor štítků). Výchozí formát je v tenants.settings. */
export class LabelTemplates1928300000000 implements MigrationInterface {
  name = 'LabelTemplates1928300000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE label_templates (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      format_key text NOT NULL,
      cells jsonb NOT NULL DEFAULT '[]',
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (tenant_id, format_key))`);
    await q.query(`ALTER TABLE label_templates ENABLE ROW LEVEL SECURITY`);
    await q.query(`ALTER TABLE label_templates FORCE ROW LEVEL SECURITY`);
    await q.query(`CREATE POLICY tenant_isolation ON label_templates
      USING (tenant_id = current_setting('app.tenant_id',true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id',true)::uuid)`);
    await q.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON label_templates TO tagery_app`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE label_templates`);
  }
}
