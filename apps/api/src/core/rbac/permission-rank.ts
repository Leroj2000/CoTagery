import type { ObjectPermissionLevel } from '@tagery/shared';

const RANK: Record<ObjectPermissionLevel, number> = {
  scan_only: 0,
  view: 1,
  edit: 2,
  manage: 3,
  owner: 4,
};

/** Splňuje `have` alespoň úroveň `required`? (ACL hierarchie) */
export function permissionMeets(
  have: ObjectPermissionLevel,
  required: ObjectPermissionLevel,
): boolean {
  return RANK[have] >= RANK[required];
}

export function highestPermission(
  levels: ObjectPermissionLevel[],
): ObjectPermissionLevel | null {
  if (levels.length === 0) return null;
  return levels.reduce((best, cur) => (RANK[cur] > RANK[best] ? cur : best));
}
