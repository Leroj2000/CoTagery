import { MigrationInterface, QueryRunner } from 'typeorm';

/** EPIC-04: DigitalObject + DataCarrier (tenant-scoped, RLS jako v ADR-0001). */
export class InitDigitalObject1745000000000 implements MigrationInterface {
  name = 'InitDigitalObject1745000000000';

  private readonly rlsTables = ['digital_objects', 'data_carriers'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "digital_objects" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "module_type" text NOT NULL,
        "slug" text NOT NULL,
        "status" text NOT NULL DEFAULT 'active',
        "primary_url" text,
        "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "valid_from" timestamptz,
        "valid_to" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_digital_objects_tenant_slug" ON "digital_objects" ("tenant_id", "slug")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "data_carriers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "digital_object_id" uuid NOT NULL REFERENCES "digital_objects"("id") ON DELETE CASCADE,
        "carrier_type" text NOT NULL DEFAULT 'qr',
        "public_code" text NOT NULL,
        "resolver_url" text,
        "qr_payload" text,
        "nfc_uid" text,
        "nfc_payload" text,
        "version" integer NOT NULL DEFAULT 1,
        "status" text NOT NULL DEFAULT 'active',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    // public_code je globálně unikátní (resolver hledá napříč tenanty) – unique
    // constraint platí i pod RLS.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_data_carriers_public_code" ON "data_carriers" ("public_code")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_data_carriers_object" ON "data_carriers" ("digital_object_id")`,
    );

    for (const table of this.rlsTables) {
      await queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
      await queryRunner.query(`
        CREATE POLICY "tenant_isolation" ON "${table}"
        USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
        WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
      `);
      // Explicitní grant (default privileges by měly stačit, ale pro jistotu).
      await queryRunner.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON "${table}" TO "tagery_app"`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.rlsTables) {
      await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "${table}"`);
    }
    await queryRunner.query(`DROP TABLE IF EXISTS "data_carriers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "digital_objects"`);
  }
}
