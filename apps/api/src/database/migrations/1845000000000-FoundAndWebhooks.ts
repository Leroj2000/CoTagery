import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 🔵 odlišující sázky: nahlášení nálezu (found_reports) + doménové webhooky
 * (webhook_endpoints, webhook_deliveries). Vše tenant-scoped, RLS.
 */
export class FoundAndWebhooks1845000000000 implements MigrationInterface {
  name = 'FoundAndWebhooks1845000000000';

  private readonly rlsTables = ['found_reports', 'webhook_endpoints', 'webhook_deliveries'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "found_reports" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "public_code" text NOT NULL,
        "digital_object_id" uuid,
        "message" text NOT NULL,
        "finder_contact" text,
        "status" text NOT NULL DEFAULT 'new',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_found_reports_code" ON "found_reports" ("public_code")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "webhook_endpoints" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "url" text NOT NULL,
        "secret" text NOT NULL,
        "events" jsonb NOT NULL DEFAULT '[]',
        "active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "endpoint_id" uuid NOT NULL REFERENCES "webhook_endpoints"("id") ON DELETE CASCADE,
        "event" text NOT NULL,
        "status_code" integer,
        "ok" boolean NOT NULL DEFAULT false,
        "error" text,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_webhook_deliveries_endpoint" ON "webhook_deliveries" ("endpoint_id")`,
    );

    for (const table of this.rlsTables) {
      await queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
      await queryRunner.query(`
        CREATE POLICY "tenant_isolation" ON "${table}"
        USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
        WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
      `);
      await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON "${table}" TO "tagery_app"`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.rlsTables) {
      await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "${table}"`);
    }
    await queryRunner.query(`DROP TABLE IF EXISTS "webhook_deliveries"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "webhook_endpoints"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "found_reports"`);
  }
}
