import { MigrationInterface, QueryRunner } from 'typeorm';

/** Databázové pojistky pro provozní workflow položek. */
export class AssetOperationalIntegrity1923000000000 implements MigrationInterface {
  name = 'AssetOperationalIntegrity1923000000000';

  public async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE UNIQUE INDEX "ux_assets_tenant_inventory_number"
      ON "assets" ("tenant_id", lower("inventory_number"))
      WHERE "inventory_number" IS NOT NULL AND btrim("inventory_number") <> ''
    `);
    await q.query(`
      CREATE INDEX "ix_reservations_asset_interval"
      ON "reservations" ("tenant_id", "asset_id", "from_at", "to_at")
      WHERE "status" = 'approved'
    `);
    await q.query(`
      ALTER TABLE "reservations" ADD CONSTRAINT "ck_reservation_interval"
      CHECK ("from_at" IS NOT NULL AND "to_at" IS NOT NULL AND "from_at" < "to_at") NOT VALID
    `);
  }

  public async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE "reservations" DROP CONSTRAINT IF EXISTS "ck_reservation_interval"`);
    await q.query(`DROP INDEX IF EXISTS "ix_reservations_asset_interval"`);
    await q.query(`DROP INDEX IF EXISTS "ux_assets_tenant_inventory_number"`);
  }
}
