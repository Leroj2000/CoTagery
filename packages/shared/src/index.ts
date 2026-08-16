/**
 * @tagery/shared – typy sdílené mezi backendem (apps/api) a frontendem (apps/web).
 * Zdroj pravdy pro doménové enumy a společné DTO. Viz docs/architecture/README.md.
 */

/** Typ modulu, který obsluhuje DigitalObject (viz docs/architecture – module_type). */
export type ModuleType =
  | 'product'
  | 'loyalty'
  | 'pay'
  | 'inventory'
  | 'trace'
  | 'membership'
  | 'ticket'
  | 'rental'
  | 'asset'
  | 'gallery'
  | 'time_tracker'
  | 'automation'
  | 'contact'
  | 'access_point';

/** Globální role uživatele v rámci tenantu (RBAC). */
export type TenantRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'EDITOR' | 'VIEWER' | 'SCAN_ONLY';

/** Per-objektová oprávnění (ACL). */
export type ObjectPermissionLevel = 'owner' | 'manage' | 'edit' | 'view' | 'scan_only';

/** Odpověď health endpointu – sdílená mezi API (produkuje) a web (konzumuje). */
export interface HealthStatus {
  status: 'ok' | 'degraded';
  uptimeSeconds: number;
  checks: {
    database: 'up' | 'down';
    redis: 'up' | 'down';
  };
  timestamp: string;
}
