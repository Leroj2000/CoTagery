import { Entity, PrimaryColumn } from 'typeorm';

/** Vazba role → permission (balíček). Kompozitní PK (EPIC-18 Fáze 1). */
@Entity('role_permissions')
export class RolePermission {
  @PrimaryColumn({ type: 'uuid', name: 'role_id' })
  roleId!: string;

  @PrimaryColumn({ type: 'uuid', name: 'permission_id' })
  permissionId!: string;
}
