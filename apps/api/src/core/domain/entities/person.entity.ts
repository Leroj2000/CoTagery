import { Column, Entity, Index } from 'typeorm';
import { BaseTenantEntity } from '../../database/base-tenant.entity';

/**
 * Osoba (Party) – sjednocená identita člověka v tenantu, oddělená od
 * uživatelského účtu (dokument §12, §38.28). Osoba může existovat bez loginu
 * (subdodavatel, externí příjemce). Cíl backlogu: sjednotit Member/RenterProfile.
 */
@Entity('people')
@Index(['tenantId', 'email'], { unique: true, where: 'email IS NOT NULL' })
export class Person extends BaseTenantEntity {
  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', nullable: true })
  email!: string | null;

  @Column({ type: 'text', nullable: true })
  phone!: string | null;

  @Column({ type: 'text', nullable: true })
  company!: string | null;

  /** Volitelná vazba na uživatelský účet (má-li osoba login). */
  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId!: string | null;
}
