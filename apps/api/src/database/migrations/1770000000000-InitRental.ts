import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * EPIC-10 Rental. renter_profiles jsou PLATFORMOVÉ (bez RLS – sdílená reputace,
 * ADR-0005); rental_items/loans/reviews jsou tenant-scoped (RLS).
 */
export class InitRental1770000000000 implements MigrationInterface {
  name = 'InitRental1770000000000';

  private readonly rlsTables = ['rental_items', 'rental_loans', 'rental_reviews'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Platformová identita nájemce – bez tenant_id, bez RLS.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "renter_profiles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "email" text NOT NULL,
        "display_name" text NOT NULL,
        "phone" text,
        "verification_level" text NOT NULL DEFAULT 'none',
        "rating_avg" numeric NOT NULL DEFAULT 0,
        "rating_count" integer NOT NULL DEFAULT 0,
        "status" text NOT NULL DEFAULT 'active',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_renter_profiles_email" ON "renter_profiles" ("email")`,
    );
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON "renter_profiles" TO "tagery_app"`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "rental_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "name" text NOT NULL,
        "serial_number" text,
        "price_per_day" numeric NOT NULL DEFAULT 0,
        "deposit" numeric NOT NULL DEFAULT 0,
        "required_verification_level" text NOT NULL DEFAULT 'contact',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "rental_loans" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "item_id" uuid NOT NULL REFERENCES "rental_items"("id") ON DELETE CASCADE,
        "renter_profile_id" uuid NOT NULL REFERENCES "renter_profiles"("id"),
        "rental_start" timestamptz,
        "rental_end" timestamptz,
        "status" text NOT NULL DEFAULT 'active',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "rental_reviews" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "loan_id" uuid NOT NULL REFERENCES "rental_loans"("id") ON DELETE CASCADE,
        "direction" text NOT NULL,
        "renter_profile_id" uuid NOT NULL REFERENCES "renter_profiles"("id"),
        "rating" integer NOT NULL,
        "comment" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    for (const table of this.rlsTables) {
      await queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
      await queryRunner.query(`
        CREATE POLICY "tenant_isolation" ON "${table}"
        USING ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
        WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true)::uuid)
      `);
      await queryRunner.query(
        `GRANT SELECT, INSERT, UPDATE, DELETE ON "${table}" TO "tagery_app"`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.rlsTables) {
      await queryRunner.query(`DROP POLICY IF EXISTS "tenant_isolation" ON "${table}"`);
    }
    await queryRunner.query(`DROP TABLE IF EXISTS "rental_reviews"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rental_loans"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "rental_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "renter_profiles"`);
  }
}
