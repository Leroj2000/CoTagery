import { MigrationInterface, QueryRunner } from 'typeorm';

/** EPIC-09 Ticketing: events, ticket_types, tickets (tenant-scoped, RLS). */
export class InitTicketing1765000000000 implements MigrationInterface {
  name = 'InitTicketing1765000000000';

  private readonly rlsTables = ['events', 'ticket_types', 'tickets'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "name" text NOT NULL,
        "starts_at" timestamptz,
        "status" text NOT NULL DEFAULT 'active',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ticket_types" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
        "name" text NOT NULL,
        "price" numeric NOT NULL DEFAULT 0,
        "quantity" integer NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tickets" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
        "ticket_type_id" uuid NOT NULL REFERENCES "ticket_types"("id") ON DELETE CASCADE,
        "buyer_name" text,
        "status" text NOT NULL DEFAULT 'paid',
        "redeemed_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_ticket_types_event" ON "ticket_types" ("event_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_tickets_event" ON "tickets" ("event_id")`,
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
    await queryRunner.query(`DROP TABLE IF EXISTS "tickets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ticket_types"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "events"`);
  }
}
