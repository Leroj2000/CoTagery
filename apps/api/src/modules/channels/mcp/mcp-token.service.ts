import { createHash, randomBytes } from 'node:crypto';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';

export const MCP_TOKEN_PREFIX = 'tgm_';
export const MAX_TOKENS_PER_USER = 10;

export function hashMcpToken(token: string): string {
  return createHash('sha256').update(`mcp:${token}`).digest('hex');
}

export interface McpTokenInfo {
  id: string;
  name: string;
  tenantId: string;
  organizationName: string | null;
  tokenPrefix: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

/**
 * Osobní tokeny pro MCP. TODO(EPIC-22): nahradit OAuth 2.1 (authorization code
 * + PKCE, dynamická registrace klientů, protected resource metadata) dle MCP
 * spec 2025-06-18; tokeny pak zůstanou jen pro skripty.
 */
@Injectable()
export class McpTokenService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async create(
    userId: string,
    tenantId: string,
    name: string,
    expiresInDays: number | null,
  ): Promise<{ token: string; info: McpTokenInfo }> {
    const [{ count }]: { count: string }[] = await this.dataSource.query(
      `SELECT count(*) FROM mcp_access_tokens WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    );
    if (Number(count) >= MAX_TOKENS_PER_USER) {
      throw new ConflictException('Dosažen limit tokenů – nejdřív nějaký zruš.');
    }
    const token = MCP_TOKEN_PREFIX + randomBytes(32).toString('base64url');
    const rows: { id: string }[] = await this.dataSource.query(
      `INSERT INTO mcp_access_tokens (user_id, tenant_id, name, token_hash, token_prefix, expires_at)
       VALUES ($1, $2, $3, $4, $5,
               CASE WHEN $6::int IS NULL THEN NULL ELSE now() + make_interval(days => $6::int) END)
       RETURNING id`,
      [userId, tenantId, name, hashMcpToken(token), token.slice(0, 8), expiresInDays],
    );
    const info = (await this.listForUser(userId)).find((t) => t.id === rows[0].id)!;
    return { token, info };
  }

  /** Ověří bearer token → {userId, tenantId}; null = neplatný/zrušený/prošlý. */
  async verify(token: string): Promise<{ id: string; userId: string; tenantId: string } | null> {
    if (!token.startsWith(MCP_TOKEN_PREFIX) || token.length > 100) return null;
    const rows: { id: string; user_id: string; tenant_id: string }[] = await this.dataSource.query(
      `UPDATE mcp_access_tokens SET last_used_at = now()
        WHERE token_hash = $1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())
        RETURNING id, user_id, tenant_id`,
      [hashMcpToken(token)],
    );
    return rows[0]
      ? { id: rows[0].id, userId: rows[0].user_id, tenantId: rows[0].tenant_id }
      : null;
  }

  async listForUser(userId: string): Promise<McpTokenInfo[]> {
    const rows: {
      id: string;
      name: string;
      tenant_id: string;
      organization_name: string | null;
      token_prefix: string;
      expires_at: Date | null;
      last_used_at: Date | null;
      created_at: Date;
    }[] = await this.dataSource.query(
      `SELECT t.id, t.name, t.tenant_id, o.name AS organization_name, t.token_prefix,
              t.expires_at, t.last_used_at, t.created_at
         FROM mcp_access_tokens t LEFT JOIN tenants o ON o.id = t.tenant_id
        WHERE t.user_id = $1 AND t.revoked_at IS NULL
        ORDER BY t.created_at DESC`,
      [userId],
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      tenantId: r.tenant_id,
      organizationName: r.organization_name,
      tokenPrefix: r.token_prefix,
      expiresAt: r.expires_at?.toISOString() ?? null,
      lastUsedAt: r.last_used_at?.toISOString() ?? null,
      createdAt: r.created_at.toISOString(),
    }));
  }

  async revokeForUser(userId: string, id: string): Promise<void> {
    const rows: unknown[] = await this.dataSource.query(
      `UPDATE mcp_access_tokens SET revoked_at = now()
        WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL RETURNING id`,
      [id, userId],
    );
    if (rows.length === 0) throw new NotFoundException('Token nenalezen');
  }
}
