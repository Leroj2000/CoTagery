import type { PermissionInfo } from '@tagery/shared';

/** Role firmy (odpověď `GET /roles`, viz API RolesService). */
export interface RoleView {
  key: string;
  name: string;
  description: string | null;
  rank: number;
  system: boolean;
  customized: boolean;
  allPermissions: boolean;
  permissions: string[];
  memberCount: number;
  editable: boolean;
  assignable: boolean;
}

export interface RolesOverview {
  catalog: PermissionInfo[];
  roles: RoleView[];
  actor: {
    roleKey: string;
    roleName: string;
    rank: number;
    canManage: boolean;
    grantable: string[];
  };
}

/** Název role podle klíče z členství (`MANAGER` / `c_…`), jinak klíč. */
export function roleName(roles: RoleView[], key: string): string {
  return roles.find((r) => r.key === key.toLowerCase())?.name ?? key;
}
