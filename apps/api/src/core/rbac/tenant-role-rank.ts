import type { TenantRole } from '@tagery/shared';

/** Hierarchie globálních rolí v tenantu (vyšší číslo = víc oprávnění). */
const RANK: Record<TenantRole, number> = {
  SCAN_ONLY: 0,
  VIEWER: 1,
  EDITOR: 2,
  MANAGER: 3,
  ADMIN: 4,
  OWNER: 5,
};

/** Splňuje role uživatele alespoň požadovanou úroveň? */
export function roleMeets(have: TenantRole, required: TenantRole): boolean {
  return RANK[have] >= RANK[required];
}
