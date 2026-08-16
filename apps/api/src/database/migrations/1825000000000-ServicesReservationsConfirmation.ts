import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Dokončení Fáze C: servis/revize (asset_services), rezervace/požadavky
 * (reservations) a potvrzení převzetí (sloupce na asset_movements). RLS.
 */
export class ServicesReservationsConfirmation1825000000000 implements MigrationInterface {
  name = 'ServicesReservationsConfirmation1825000000000';

  private readonly rlsTables = ['asset_services', 'reservations'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Potvrzení převzetí na pohybech
    await queryRunner.query(
      `ALTER TABLE "asset_movements" ADD COLUMN IF NOT EXISTS "confirmation" text NOT NULL DEFAULT 'none'`,
    );
    await queryRunner.query(
      `ALTER TABLE "asset_movements" ADD COLUMN IF NOT EXISTS "confirmed_at" timestamptz`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "asset_services" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "asset_id" uuid NOT NULL REFERENCES "assets"("id") ON DELETE CASCADE,
        "kind" text NOT NULL,
        "performed_at" timestamptz,
        "next_due_at" timestamptz,
        "provider" text,
        "cost" numeric,
        "note" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_asset_services_asset" ON "asset_services" ("asset_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_asset_services_due" ON "asset_services" ("next_due_at")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reservations" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "asset_id" uuid NOT NULL REFERENCES "assets"("id") ON DELETE CASCADE,
        "requested_by_id" uuid REFERENCES "people"("id") ON DELETE SET NULL,
        "from_at" timestamptz,
        "to_at" timestamptz,
        "purpose" text,
        "status" text NOT NULL DEFAULT 'pending',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_reservations_asset" ON "reservations" ("asset_id")`,
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
    await queryRunner.query(`DROP TABLE IF EXISTS "reservations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "asset_services"`);
    await queryRunner.query(`ALTER TABLE "asset_movements" DROP COLUMN IF EXISTS "confirmed_at"`);
    await queryRunner.query(`ALTER TABLE "asset_movements" DROP COLUMN IF EXISTS "confirmation"`);
  }
}
