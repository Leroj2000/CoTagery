import { randomBytes } from 'node:crypto';
import { ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuthService } from '../../core/auth/auth.service';
import { TenantContextService } from '../../core/tenancy/tenant-context.service';
import type { CreateTenantDto } from './dto/platform.dto';
import { MVP_DEFAULT_INACTIVE_MODULES } from '../../core/rbac/modules.service';

export interface TenantSummary {
  id: string;
  name: string;
  type: string;
  slug: string | null;
  userCount: number;
  assetCount: number;
  createdAt: string;
}

export interface CreatedTenant {
  tenant: { id: string; name: string; slug: string };
  owner: { email: string; name: string; tempPassword: string };
}

/** Diakritiku pryč, non-alnum → '-', trim (slug firmy pro veřejné URL). */
function slugify(input: string): string {
  return (
    input
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'firma'
  );
}

/**
 * Platform-admin operace nad všemi firmami (ADR-0009). Běží mimo tenant RLS:
 * `tenants`/`users` nemají RLS (přímý přístup), členství se zapisuje přes
 * `runInTenant`, cross-tenant počty přes SECURITY DEFINER `platform_tenant_stats()`.
 */
@Injectable()
export class PlatformService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly context: TenantContextService,
  ) {}

  async listTenants(): Promise<TenantSummary[]> {
    const rows = await this.dataSource.query(`
      SELECT t.id, t.name, t.type, t.slug, t.created_at,
             COALESCE(s.user_count, 0) AS user_count,
             COALESCE(s.asset_count, 0) AS asset_count
      FROM tenants t
      LEFT JOIN platform_tenant_stats() s ON s.tenant_id = t.id
      WHERE t.id <> '00000000-0000-0000-0000-000000000000'
      ORDER BY t.created_at DESC
    `);
    return (rows as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      name: String(r.name),
      type: String(r.type),
      slug: (r.slug as string | null) ?? null,
      userCount: Number(r.user_count),
      assetCount: Number(r.asset_count),
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    }));
  }

  /** Unikátní slug napříč firmami (append -2, -3 … při kolizi). */
  private async uniqueSlug(base: string): Promise<string> {
    const root = slugify(base);
    const taken = new Set<string>(
      (
        (await this.dataSource.query(`SELECT slug FROM tenants WHERE slug = $1 OR slug LIKE $2`, [
          root,
          `${root}-%`,
        ])) as { slug: string }[]
      ).map((r) => r.slug),
    );
    if (!taken.has(root)) return root;
    for (let i = 2; i < 1000; i += 1) {
      if (!taken.has(`${root}-${i}`)) return `${root}-${i}`;
    }
    return `${root}-${Date.now()}`;
  }

  async createTenant(dto: CreateTenantDto): Promise<CreatedTenant> {
    const email = dto.ownerEmail.trim().toLowerCase();
    const existing = await this.dataSource.query(`SELECT 1 FROM users WHERE email = $1`, [email]);
    if (existing.length > 0) throw new ConflictException('E-mail už je registrovaný');

    const slug = await this.uniqueSlug(dto.name);
    const type = dto.type ?? 'mixed';
    const tenantRows = await this.dataSource.query(
      `INSERT INTO tenants (name, type, slug) VALUES ($1, $2, $3) RETURNING id`,
      [dto.name.trim(), type, slug],
    );
    const tenantId = tenantRows[0].id as string;

    const tempPassword = randomBytes(6).toString('base64url'); // ~8 znaků k předání
    const passwordHash = await AuthService.hashPassword(tempPassword);
    const ownerName = dto.ownerName.trim();
    const userRows = await this.dataSource.query(
      `INSERT INTO users (tenant_id, email, name, password_hash, tenant_role, status)
       VALUES ($1, $2, $3, $4, 'OWNER', 'active') RETURNING id`,
      [tenantId, email, ownerName, passwordHash],
    );
    const userId = userRows[0].id as string;

    // org_memberships + role_assignments mají RLS → zápis v kontextu nové firmy.
    await this.context.runInTenant(tenantId, async () => {
      const m = await this.context.manager.query(
        `INSERT INTO org_memberships (tenant_id, user_id, role, status)
         VALUES ($1, $2, 'OWNER', 'active') RETURNING id`,
        [tenantId, userId],
      );
      await this.context.manager.query(
        `INSERT INTO role_assignments (tenant_id, membership_id, role_key, scope_type)
         VALUES ($1, $2, 'OWNER', 'ORGANIZATION')`,
        [tenantId, m[0].id],
      );
      // Nová firma začíná jako přehledné Tagery Věci. Rozšíření si vlastník
      // zapne vědomě v nastavení; stávajícím firmám jejich stav neměníme.
      await this.context.manager.query(
        `INSERT INTO organization_modules (tenant_id, module_key, state)
         SELECT $1, module_key, 'inactive'
           FROM unnest($2::text[]) AS module_key
         ON CONFLICT (tenant_id, module_key) DO NOTHING`,
        [tenantId, [...MVP_DEFAULT_INACTIVE_MODULES]],
      );
    });

    return {
      tenant: { id: tenantId, name: dto.name.trim(), slug },
      owner: { email, name: ownerName, tempPassword },
    };
  }
}
