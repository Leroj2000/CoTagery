import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Pozastavení člena je per firma (`org_memberships.status`), ne na účtu
 * (`users.status` je společný všem firmám – zablokoval by člověka všude).
 * Dřívější pozastavení účtu se převede na pozastavení jeho členství a účet se
 * odblokuje.
 */
export class MembershipSuspension1929000000000 implements MigrationInterface {
  name = 'MembershipSuspension1929000000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`UPDATE org_memberships m SET status = 'suspended'
      FROM users u WHERE u.id = m.user_id AND u.status = 'suspended'`);
    await q.query(`UPDATE users SET status = 'active' WHERE status = 'suspended'`);
  }

  async down(): Promise<void> {
    // Nevratné: nelze rozlišit, která pozastavení vznikla na účtu.
  }
}
