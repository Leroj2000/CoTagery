import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * EPIC-16 Membership: members, membership_tiers, memberships, membership_cards,
 * membership_benefits (tenant-scoped, RLS – ADR-0001).
 */
export class InitMembership1795000000000 implements MigrationInterface {
  name = 'InitMembership1795000000000';

  private readonly rlsTables = [
    'members',
    'membership_tiers',
    'memberships',
    'membership_cards',
    'membership_benefits',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "members" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "name" text NOT NULL,
        "email" text,
        "phone" text,
        "external_ref" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_members_tenant_email" ON "members" ("tenant_id", "email") WHERE "email" IS NOT NULL`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "membership_tiers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "name" text NOT NULL,
        "level" integer NOT NULL DEFAULT 0,
        "price" numeric NOT NULL DEFAULT 0,
        "currency" text NOT NULL DEFAULT 'CZK',
        "validity_days" integer NOT NULL DEFAULT 365,
        "grace_days" integer NOT NULL DEFAULT 7,
        "zone_keys" jsonb NOT NULL DEFAULT '[]',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "memberships" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "member_id" uuid NOT NULL REFERENCES "members"("id") ON DELETE CASCADE,
        "tier_id" uuid NOT NULL REFERENCES "membership_tiers"("id") ON DELETE RESTRICT,
        "status" text NOT NULL DEFAULT 'active',
        "valid_from" timestamptz NOT NULL,
        "valid_to" timestamptz NOT NULL,
        "auto_renew" boolean NOT NULL DEFAULT false,
        "subscription_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_memberships_member" ON "memberships" ("member_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "membership_cards" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "membership_id" uuid NOT NULL REFERENCES "memberships"("id") ON DELETE CASCADE,
        "data_carrier_id" uuid NOT NULL REFERENCES "data_carriers"("id") ON DELETE CASCADE,
        "status" text NOT NULL DEFAULT 'active',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_membership_cards_membership" ON "membership_cards" ("membership_id")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_membership_cards_carrier" ON "membership_cards" ("data_carrier_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "membership_benefits" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "tier_id" uuid NOT NULL REFERENCES "membership_tiers"("id") ON DELETE CASCADE,
        "kind" text NOT NULL,
        "target_key" text,
        "value" numeric,
        "description" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_membership_benefits_tier" ON "membership_benefits" ("tier_id")`,
    );

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
    await queryRunner.query(`DROP TABLE IF EXISTS "membership_benefits"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "membership_cards"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "memberships"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "membership_tiers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "members"`);
  }
}
