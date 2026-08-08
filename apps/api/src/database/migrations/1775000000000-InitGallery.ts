import { MigrationInterface, QueryRunner } from 'typeorm';

/** EPIC-11 Gallery: gallery_events + upload_items (tenant-scoped, RLS). */
export class InitGallery1775000000000 implements MigrationInterface {
  name = 'InitGallery1775000000000';

  private readonly rlsTables = ['gallery_events', 'upload_items'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "gallery_events" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "digital_object_id" uuid REFERENCES "digital_objects"("id") ON DELETE SET NULL,
        "name" text NOT NULL,
        "event_date" timestamptz,
        "delete_after_days" integer,
        "is_private" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "ux_gallery_events_object" ON "gallery_events" ("digital_object_id") WHERE "digital_object_id" IS NOT NULL`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "upload_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
        "gallery_event_id" uuid NOT NULL REFERENCES "gallery_events"("id") ON DELETE CASCADE,
        "file_key" text NOT NULL,
        "mime_type" text,
        "size_bytes" integer NOT NULL DEFAULT 0,
        "status" text NOT NULL DEFAULT 'pending',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "ix_upload_items_gallery" ON "upload_items" ("gallery_event_id")`,
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
    await queryRunner.query(`DROP TABLE IF EXISTS "upload_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "gallery_events"`);
  }
}
