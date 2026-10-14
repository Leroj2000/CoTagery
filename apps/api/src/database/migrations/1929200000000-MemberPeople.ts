import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Každý člen firmy je zároveň osobou (people) – jde mu vydat položku, být
 * žadatelem, mít „Moje vybavení“. Trigger na `org_memberships` při vzniku
 * členství propojí uživatele s osobou se stejným e-mailem, jinak ji založí.
 * Všechna členství vznikají s `app.tenant_id` nastaveným na danou firmu,
 * takže zápis do `people` projde RLS (funkce běží s právy volajícího).
 * Zpětně doplní osoby stávajícím členům a sjednotí jejich kategorie.
 */
export class MemberPeople1929200000000 implements MigrationInterface {
  name = 'MemberPeople1929200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION link_member_person() RETURNS trigger
      LANGUAGE plpgsql AS $$
      DECLARE
        u RECORD;
        pid uuid;
      BEGIN
        IF EXISTS (SELECT 1 FROM people WHERE tenant_id = NEW.tenant_id AND user_id = NEW.user_id) THEN
          RETURN NEW;
        END IF;
        SELECT id, name, email INTO u FROM users WHERE id = NEW.user_id;
        IF NOT FOUND THEN
          RETURN NEW;
        END IF;
        SELECT id INTO pid FROM people
         WHERE tenant_id = NEW.tenant_id AND user_id IS NULL
           AND email IS NOT NULL AND lower(email) = lower(u.email)
         ORDER BY created_at
         LIMIT 1;
        IF pid IS NOT NULL THEN
          UPDATE people SET user_id = u.id, updated_at = now()
           WHERE tenant_id = NEW.tenant_id AND id = pid;
        ELSE
          INSERT INTO people (tenant_id, name, email, user_id)
          VALUES (
            NEW.tenant_id,
            u.name,
            CASE WHEN EXISTS (
              SELECT 1 FROM people WHERE tenant_id = NEW.tenant_id AND lower(email) = lower(u.email)
            ) THEN NULL ELSE u.email END,
            u.id
          );
        END IF;
        RETURN NEW;
      END $$
    `);
    await queryRunner.query(`DROP TRIGGER IF EXISTS "trg_member_person" ON "org_memberships"`);
    await queryRunner.query(`
      CREATE TRIGGER "trg_member_person" AFTER INSERT ON "org_memberships"
      FOR EACH ROW EXECUTE FUNCTION link_member_person()
    `);

    // Zpětně: 1) propojit osobu se stejným e-mailem, 2) ostatním osobu založit.
    await queryRunner.query(`
      UPDATE people p SET user_id = x.user_id, updated_at = now()
        FROM (
          SELECT DISTINCT ON (m.tenant_id, m.user_id) m.tenant_id, m.user_id, pp.id AS person_id
            FROM org_memberships m
            JOIN users u ON u.id = m.user_id
            JOIN people pp ON pp.tenant_id = m.tenant_id AND pp.user_id IS NULL
                          AND pp.email IS NOT NULL AND lower(pp.email) = lower(u.email)
           WHERE NOT EXISTS (
             SELECT 1 FROM people q WHERE q.tenant_id = m.tenant_id AND q.user_id = m.user_id
           )
           ORDER BY m.tenant_id, m.user_id, pp.created_at
        ) x
       WHERE p.tenant_id = x.tenant_id AND p.id = x.person_id
    `);
    await queryRunner.query(`
      INSERT INTO people (tenant_id, name, email, user_id)
      SELECT m.tenant_id, u.name,
             CASE WHEN EXISTS (
               SELECT 1 FROM people e WHERE e.tenant_id = m.tenant_id AND lower(e.email) = lower(u.email)
             ) THEN NULL ELSE u.email END,
             u.id
        FROM org_memberships m
        JOIN users u ON u.id = m.user_id
       WHERE NOT EXISTS (
         SELECT 1 FROM people q WHERE q.tenant_id = m.tenant_id AND q.user_id = m.user_id
       )
    `);

    // Kategorie: uživatel i jeho osoba mají stejné zařazení (sjednocení obou).
    await queryRunner.query(`
      INSERT INTO category_links (tenant_id, category_id, subject_type, subject_id)
      SELECT l.tenant_id, l.category_id, 'person', p.id
        FROM category_links l
        JOIN people p ON p.tenant_id = l.tenant_id AND p.user_id = l.subject_id
       WHERE l.subject_type = 'user'
      ON CONFLICT DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO category_links (tenant_id, category_id, subject_type, subject_id)
      SELECT l.tenant_id, l.category_id, 'user', p.user_id
        FROM category_links l
        JOIN people p ON p.tenant_id = l.tenant_id AND p.id = l.subject_id
        JOIN org_memberships m ON m.tenant_id = p.tenant_id AND m.user_id = p.user_id
       WHERE l.subject_type = 'person'
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Založené osoby zůstávají (mohou na ně vést pohyby a požadavky).
    await queryRunner.query(`DROP TRIGGER IF EXISTS "trg_member_person" ON "org_memberships"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS link_member_person()`);
  }
}
