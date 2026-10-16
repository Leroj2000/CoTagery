import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type EntityManager } from 'typeorm';
import { AuditService } from '../../../core/rbac/audit.service';
import { TenantContextService } from '../../../core/tenancy/tenant-context.service';
import { ActionExecutorService } from '../actions/action-executor.service';
import { returningRows } from '../channel.types';
import {
  ACCESS_TOKEN_TTL_SEC,
  CODE_TTL_SEC,
  DEFAULT_REDIRECT_HOSTS,
  OAUTH_SCOPE,
  REFRESH_TOKEN_TTL_DAYS,
  appendQuery,
  isAllowedRedirectUri,
  isValidChallenge,
  normalizeScope,
  oauthHash,
  randomToken,
  resourceMatches,
  safeEqual,
  verifyPkce,
} from './oauth.util';

/** Chyba OAuth (RFC 6749 §5.2 / RFC 7591 §3.2.2) – controller ji převede na JSON. */
export class OAuthError extends Error {
  constructor(
    public readonly error: string,
    public readonly description: string,
    public readonly status = 400,
  ) {
    super(description);
  }
}

export interface AuthorizeParams {
  response_type?: string;
  client_id?: string;
  redirect_uri?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  scope?: string;
  state?: string;
  resource?: string;
}

export type AuthorizeCheck =
  | {
      ok: true;
      clientId: string;
      clientName: string;
      clientUri: string | null;
      redirectUri: string;
      scope: string;
      resource: string;
      state?: string;
      codeChallenge: string;
    }
  | { ok: false; error: string; description: string; redirectTo: string | null };

export interface ClientAuth {
  clientId?: string;
  clientSecret?: string;
  /** Způsob, jakým klient secret poslal (pro kontrolu registrované metody). */
  method: 'none' | 'client_secret_post' | 'client_secret_basic';
}

interface ClientRow {
  id: string;
  client_id: string;
  client_secret_hash: string | null;
  client_name: string;
  client_uri: string | null;
  redirect_uris: string[];
  token_endpoint_auth_method: ClientAuth['method'];
}

export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export interface OAuthGrantInfo {
  id: string;
  clientName: string;
  clientUri: string | null;
  tenantId: string;
  organizationName: string | null;
  scope: string;
  createdAt: string;
  lastUsedAt: string | null;
}

/**
 * OAuth 2.1 autorizační server pro MCP (jen authorization code + PKCE S256,
 * veřejní i důvěrní klienti z dynamické registrace). Access token je vázaný na
 * uživatele, firmu, klienta a resource (`<issuer>/mcp`); oprávnění a členství
 * se ověřují při každém volání MCP přes ActionExecutor.
 */
@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly executor: ActionExecutorService,
    private readonly context: TenantContextService,
    private readonly audit: AuditService,
  ) {}

  /** Veřejná adresa (issuer) – stejný origin jako web a MCP. */
  issuer(): string {
    return (
      this.config.get<string>('OAUTH_ISSUER') ??
      this.config.get<string>('PUBLIC_WEB_URL') ??
      'http://localhost:3000'
    ).replace(/\/+$/, '');
  }

  resource(): string {
    return `${this.issuer()}/mcp`;
  }

  resourceMetadataUrl(): string {
    return `${this.issuer()}/.well-known/oauth-protected-resource/mcp`;
  }

  private redirectHosts(): string[] {
    const extra = (this.config.get<string>('OAUTH_REDIRECT_HOSTS') ?? '')
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);
    return [...DEFAULT_REDIRECT_HOSTS, ...extra];
  }

  protectedResourceMetadata(): Record<string, unknown> {
    return {
      resource: this.resource(),
      authorization_servers: [this.issuer()],
      scopes_supported: [OAUTH_SCOPE],
      bearer_methods_supported: ['header'],
      resource_name: 'Tagery',
      resource_documentation: `${this.issuer()}/admin/webhooks/channels`,
    };
  }

  authorizationServerMetadata(): Record<string, unknown> {
    const iss = this.issuer();
    const authMethods = ['none', 'client_secret_post', 'client_secret_basic'];
    return {
      issuer: iss,
      authorization_endpoint: `${iss}/oauth/authorize`,
      token_endpoint: `${iss}/oauth/token`,
      registration_endpoint: `${iss}/oauth/register`,
      revocation_endpoint: `${iss}/oauth/revoke`,
      response_types_supported: ['code'],
      response_modes_supported: ['query'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: authMethods,
      revocation_endpoint_auth_methods_supported: authMethods,
      scopes_supported: [OAUTH_SCOPE],
      authorization_response_iss_parameter_supported: true,
      service_documentation: `${iss}/admin/webhooks/channels`,
    };
  }

  // --- Dynamická registrace klientů (RFC 7591) ---

  async registerClient(
    body: Record<string, unknown>,
    ip: string | null,
  ): Promise<Record<string, unknown>> {
    const redirectUris = body.redirect_uris;
    if (
      !Array.isArray(redirectUris) ||
      redirectUris.length === 0 ||
      redirectUris.length > 10 ||
      !redirectUris.every((u) => typeof u === 'string' && u.length <= 2000)
    ) {
      throw new OAuthError('invalid_redirect_uri', 'redirect_uris must be a non-empty array');
    }
    const hosts = this.redirectHosts();
    const bad = (redirectUris as string[]).find((u) => !isAllowedRedirectUri(u, hosts));
    if (bad) {
      throw new OAuthError('invalid_redirect_uri', `redirect_uri not allowed: ${bad}`);
    }
    const method = (body.token_endpoint_auth_method ?? 'client_secret_basic') as string;
    if (!['none', 'client_secret_post', 'client_secret_basic'].includes(method)) {
      throw new OAuthError('invalid_client_metadata', 'token_endpoint_auth_method not supported');
    }
    const grantTypes = (body.grant_types ?? ['authorization_code', 'refresh_token']) as unknown;
    if (
      !Array.isArray(grantTypes) ||
      !grantTypes.every((g) => g === 'authorization_code' || g === 'refresh_token')
    ) {
      throw new OAuthError('invalid_client_metadata', 'unsupported grant_types');
    }
    const responseTypes = (body.response_types ?? ['code']) as unknown;
    if (!Array.isArray(responseTypes) || !responseTypes.every((r) => r === 'code')) {
      throw new OAuthError('invalid_client_metadata', 'unsupported response_types');
    }
    const str = (v: unknown, max: number): string | null =>
      typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
    const clientName = str(body.client_name, 120) ?? 'MCP klient';
    let clientUri = str(body.client_uri, 500);
    if (clientUri && !/^https:\/\//.test(clientUri)) clientUri = null;

    const clientId = randomToken('tgc_', 16);
    const secret = method === 'none' ? null : randomToken('tgs_', 32);
    await this.dataSource.query(
      `INSERT INTO mcp_oauth_clients
         (client_id, client_secret_hash, client_name, redirect_uris, token_endpoint_auth_method,
          client_uri, software_id, created_ip)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        clientId,
        secret ? oauthHash(secret) : null,
        clientName,
        redirectUris,
        method,
        clientUri,
        str(body.software_id, 200),
        ip,
      ],
    );
    return {
      client_id: clientId,
      ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: clientName,
      ...(clientUri ? { client_uri: clientUri } : {}),
      redirect_uris: redirectUris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: method,
      scope: OAUTH_SCOPE,
    };
  }

  private async findClient(clientId: string | undefined): Promise<ClientRow | null> {
    if (!clientId || clientId.length > 100) return null;
    const rows: ClientRow[] = await this.dataSource.query(
      `SELECT id, client_id, client_secret_hash, client_name, client_uri, redirect_uris,
              token_endpoint_auth_method
         FROM mcp_oauth_clients WHERE client_id = $1`,
      [clientId],
    );
    return rows[0] ?? null;
  }

  /** Ověření klienta na token/revoke endpointu podle registrované metody. */
  private async authenticateClient(auth: ClientAuth): Promise<ClientRow> {
    const client = await this.findClient(auth.clientId);
    if (!client) throw new OAuthError('invalid_client', 'Unknown client', 401);
    if (client.token_endpoint_auth_method === 'none') return client;
    if (
      !auth.clientSecret ||
      !client.client_secret_hash ||
      !safeEqual(oauthHash(auth.clientSecret), client.client_secret_hash)
    ) {
      throw new OAuthError('invalid_client', 'Client authentication failed', 401);
    }
    return client;
  }

  // --- Autorizační endpoint (souhlas na webu) ---

  async checkAuthorize(p: AuthorizeParams): Promise<AuthorizeCheck> {
    const client = await this.findClient(p.client_id);
    if (!client) {
      return {
        ok: false,
        error: 'invalid_client',
        description: 'Neznámý klient.',
        redirectTo: null,
      };
    }
    let redirectUri = p.redirect_uri;
    if (!redirectUri && client.redirect_uris.length === 1) redirectUri = client.redirect_uris[0];
    if (!redirectUri || !client.redirect_uris.includes(redirectUri)) {
      return {
        ok: false,
        error: 'invalid_request',
        description: 'Adresa pro návrat (redirect_uri) neodpovídá registraci klienta.',
        redirectTo: null,
      };
    }
    const fail = (error: string, description: string): AuthorizeCheck => ({
      ok: false,
      error,
      description,
      redirectTo: appendQuery(redirectUri!, {
        error,
        error_description: description,
        state: p.state,
        iss: this.issuer(),
      }),
    });
    if (p.response_type !== 'code') {
      return fail('unsupported_response_type', 'Only response_type=code is supported');
    }
    if (
      p.code_challenge_method !== 'S256' ||
      !p.code_challenge ||
      !isValidChallenge(p.code_challenge)
    ) {
      return fail('invalid_request', 'PKCE with code_challenge_method=S256 is required');
    }
    const scope = normalizeScope(p.scope);
    if (!scope) return fail('invalid_scope', 'Only the "mcp" scope is supported');
    if (!resourceMatches(p.resource, this.resource())) {
      return fail('invalid_target', 'Unknown resource');
    }
    return {
      ok: true,
      clientId: client.client_id,
      clientName: client.client_name,
      clientUri: client.client_uri,
      redirectUri,
      scope,
      resource: this.resource(),
      state: p.state,
      codeChallenge: p.code_challenge,
    };
  }

  /** Rozhodnutí uživatele → URL pro návrat ke klientovi (s kódem nebo chybou). */
  async decide(
    userId: string,
    p: AuthorizeParams & { tenantId?: string; decision?: string },
  ): Promise<{ redirectUrl: string }> {
    const check = await this.checkAuthorize(p);
    if (!check.ok) {
      if (!check.redirectTo) throw new OAuthError(check.error, check.description);
      return { redirectUrl: check.redirectTo };
    }
    const back = (params: Record<string, string | undefined>) => ({
      redirectUrl: appendQuery(check.redirectUri, {
        ...params,
        state: check.state,
        iss: this.issuer(),
      }),
    });
    if (p.decision !== 'approve') {
      return back({ error: 'access_denied', error_description: 'The user denied access' });
    }
    const membership = (await this.executor.memberships(userId)).find(
      (m) => m.organization_id === p.tenantId,
    );
    if (!membership)
      throw new OAuthError('access_denied', 'Nejsi aktivním členem této firmy.', 403);

    const code = randomToken('tga_', 32);
    const grantId = await this.dataSource.transaction(async (m) => {
      const client = (await this.findClientTx(m, check.clientId))!;
      const [grant]: { id: string }[] = await m.query(
        `INSERT INTO mcp_oauth_grants (client_id, user_id, tenant_id, scope, resource)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [client.id, userId, membership.organization_id, check.scope, check.resource],
      );
      await m.query(
        `INSERT INTO mcp_oauth_codes (code_hash, grant_id, redirect_uri, code_challenge, expires_at)
         VALUES ($1, $2, $3, $4, now() + make_interval(secs => $5))`,
        [oauthHash(code), grant.id, check.redirectUri, check.codeChallenge, CODE_TTL_SEC],
      );
      // Úklid: prošlé kódy starší než den.
      await m.query(`DELETE FROM mcp_oauth_codes WHERE expires_at < now() - interval '1 day'`);
      return grant.id;
    });
    await this.auditGrant(membership.organization_id, userId, 'channel.oauth.authorize', grantId, {
      client: check.clientName,
    });
    return back({ code });
  }

  private async findClientTx(m: EntityManager, clientId: string): Promise<{ id: string } | null> {
    const rows: { id: string }[] = await m.query(
      `SELECT id FROM mcp_oauth_clients WHERE client_id = $1`,
      [clientId],
    );
    return rows[0] ?? null;
  }

  // --- Token endpoint ---

  async token(body: Record<string, string | undefined>, auth: ClientAuth): Promise<TokenResponse> {
    const client = await this.authenticateClient(auth);
    if (body.grant_type === 'authorization_code') return this.exchangeCode(client, body);
    if (body.grant_type === 'refresh_token') return this.refresh(client, body);
    throw new OAuthError('unsupported_grant_type', 'Unsupported grant_type');
  }

  private async exchangeCode(
    client: ClientRow,
    body: Record<string, string | undefined>,
  ): Promise<TokenResponse> {
    const code = body.code ?? '';
    if (!code.startsWith('tga_')) throw new OAuthError('invalid_grant', 'Invalid code');
    const result = await this.dataSource.transaction(async (m) => {
      const rows: {
        id: string;
        grant_id: string;
        redirect_uri: string;
        code_challenge: string;
        expired: boolean;
        used_at: Date | null;
        client_id: string;
        resource: string;
        scope: string;
        revoked_at: Date | null;
      }[] = await m.query(
        `SELECT c.id, c.grant_id, c.redirect_uri, c.code_challenge, c.expires_at < now() AS expired,
                c.used_at, g.client_id, g.resource, g.scope, g.revoked_at
           FROM mcp_oauth_codes c JOIN mcp_oauth_grants g ON g.id = c.grant_id
          WHERE c.code_hash = $1 FOR UPDATE OF c`,
        [oauthHash(code)],
      );
      const row = rows[0];
      if (!row) return { error: 'Invalid code' } as const;
      if (row.used_at) {
        // Opakované použití kódu = možný únik → zneplatnit celé povolení (RFC 6749 §4.1.2).
        await this.revokeGrantTx(m, row.grant_id);
        return { error: 'Code already used' } as const;
      }
      await m.query(`UPDATE mcp_oauth_codes SET used_at = now() WHERE id = $1`, [row.id]);
      if (row.expired || row.revoked_at) return { error: 'Code expired' } as const;
      if (row.client_id !== client.id)
        return { error: 'Code was issued to another client' } as const;
      if ((body.redirect_uri ?? row.redirect_uri) !== row.redirect_uri) {
        return { error: 'redirect_uri mismatch' } as const;
      }
      if (!verifyPkce(body.code_verifier ?? '', row.code_challenge)) {
        return { error: 'PKCE verification failed' } as const;
      }
      if (!resourceMatches(body.resource, row.resource)) {
        return { error: 'resource mismatch' } as const;
      }
      return { tokens: await this.issueTokens(m, row.grant_id, row.scope) } as const;
    });
    if ('error' in result) throw new OAuthError('invalid_grant', result.error!);
    await this.touchClient(client.id);
    return result.tokens;
  }

  private async refresh(
    client: ClientRow,
    body: Record<string, string | undefined>,
  ): Promise<TokenResponse> {
    const token = body.refresh_token ?? '';
    if (!token.startsWith('tgr_')) throw new OAuthError('invalid_grant', 'Invalid refresh token');
    const result = await this.dataSource.transaction(async (m) => {
      const rows: {
        id: string;
        grant_id: string;
        token_revoked: Date | null;
        expired: boolean;
        client_id: string;
        grant_revoked: Date | null;
        scope: string;
        resource: string;
      }[] = await m.query(
        `SELECT t.id, t.grant_id, t.revoked_at AS token_revoked, t.expires_at < now() AS expired,
                g.client_id, g.revoked_at AS grant_revoked, g.scope, g.resource
           FROM mcp_oauth_tokens t JOIN mcp_oauth_grants g ON g.id = t.grant_id
          WHERE t.token_hash = $1 AND t.kind = 'refresh' FOR UPDATE OF t`,
        [oauthHash(token)],
      );
      const row = rows[0];
      if (!row || row.client_id !== client.id) return { error: 'Invalid refresh token' } as const;
      if (row.token_revoked) {
        // Znovupoužití rotovaného refresh tokenu → zneplatnit celé povolení.
        await this.revokeGrantTx(m, row.grant_id);
        return { error: 'Refresh token reuse detected' } as const;
      }
      if (row.expired || row.grant_revoked) return { error: 'Refresh token expired' } as const;
      if (!resourceMatches(body.resource, row.resource)) {
        return { error: 'resource mismatch' } as const;
      }
      if (body.scope && normalizeScope(body.scope) !== row.scope) {
        return { error: 'scope exceeds grant' } as const;
      }
      await m.query(`UPDATE mcp_oauth_tokens SET revoked_at = now() WHERE id = $1`, [row.id]);
      return { tokens: await this.issueTokens(m, row.grant_id, row.scope) } as const;
    });
    if ('error' in result) throw new OAuthError('invalid_grant', result.error!);
    await this.touchClient(client.id);
    return result.tokens;
  }

  private async issueTokens(
    m: EntityManager,
    grantId: string,
    scope: string,
  ): Promise<TokenResponse> {
    const access = randomToken('tgo_', 32);
    const refresh = randomToken('tgr_', 32);
    await m.query(
      `INSERT INTO mcp_oauth_tokens (grant_id, kind, token_hash, expires_at) VALUES
         ($1, 'access', $2, now() + make_interval(secs => $4)),
         ($1, 'refresh', $3, now() + make_interval(days => $5))`,
      [
        grantId,
        oauthHash(access),
        oauthHash(refresh),
        ACCESS_TOKEN_TTL_SEC,
        REFRESH_TOKEN_TTL_DAYS,
      ],
    );
    // Úklid prošlých tokenů tohoto povolení.
    await m.query(
      `DELETE FROM mcp_oauth_tokens WHERE grant_id = $1 AND expires_at < now() - interval '1 day'`,
      [grantId],
    );
    return {
      access_token: access,
      token_type: 'Bearer',
      expires_in: ACCESS_TOKEN_TTL_SEC,
      refresh_token: refresh,
      scope,
    };
  }

  private async touchClient(id: string): Promise<void> {
    await this.dataSource.query(`UPDATE mcp_oauth_clients SET last_used_at = now() WHERE id = $1`, [
      id,
    ]);
  }

  private async revokeGrantTx(m: EntityManager, grantId: string): Promise<void> {
    await m.query(
      `UPDATE mcp_oauth_grants SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL`,
      [grantId],
    );
    await m.query(
      `UPDATE mcp_oauth_tokens SET revoked_at = now() WHERE grant_id = $1 AND revoked_at IS NULL`,
      [grantId],
    );
  }

  /** Ověření access tokenu pro /mcp (audience = náš resource). */
  async verifyAccessToken(
    token: string,
  ): Promise<{ grantId: string; userId: string; tenantId: string } | null> {
    if (!token.startsWith('tgo_') || token.length > 100) return null;
    const rows: { grant_id: string; user_id: string; tenant_id: string }[] = returningRows(
      await this.dataSource.query(
        `UPDATE mcp_oauth_grants g SET last_used_at = now()
           FROM mcp_oauth_tokens t
          WHERE t.grant_id = g.id AND t.token_hash = $1 AND t.kind = 'access'
            AND t.revoked_at IS NULL AND t.expires_at > now()
            AND g.revoked_at IS NULL AND g.resource = $2
          RETURNING g.id AS grant_id, g.user_id, g.tenant_id`,
        [oauthHash(token), this.resource()],
      ),
    );
    const row = rows[0];
    return row ? { grantId: row.grant_id, userId: row.user_id, tenantId: row.tenant_id } : null;
  }

  /** RFC 7009 – odvolání tokenu klientem (vždy 200; refresh token ruší celé povolení). */
  async revokeToken(token: string | undefined, auth: ClientAuth): Promise<void> {
    const client = await this.authenticateClient(auth);
    if (!token) return;
    await this.dataSource.transaction(async (m) => {
      const rows: { id: string; grant_id: string; kind: string }[] = await m.query(
        `SELECT t.id, t.grant_id, t.kind FROM mcp_oauth_tokens t
           JOIN mcp_oauth_grants g ON g.id = t.grant_id
          WHERE t.token_hash = $1 AND g.client_id = $2`,
        [oauthHash(token), client.id],
      );
      const row = rows[0];
      if (!row) return;
      if (row.kind === 'refresh') await this.revokeGrantTx(m, row.grant_id);
      else await m.query(`UPDATE mcp_oauth_tokens SET revoked_at = now() WHERE id = $1`, [row.id]);
    });
  }

  // --- Správa povolení uživatelem (Propojené kanály) ---

  async listGrants(userId: string): Promise<OAuthGrantInfo[]> {
    const rows: {
      id: string;
      client_name: string;
      client_uri: string | null;
      tenant_id: string;
      organization_name: string | null;
      scope: string;
      created_at: Date;
      last_used_at: Date | null;
    }[] = await this.dataSource.query(
      `SELECT g.id, c.client_name, c.client_uri, g.tenant_id, o.name AS organization_name,
              g.scope, g.created_at, g.last_used_at
         FROM mcp_oauth_grants g
         JOIN mcp_oauth_clients c ON c.id = g.client_id
         LEFT JOIN tenants o ON o.id = g.tenant_id
        WHERE g.user_id = $1 AND g.revoked_at IS NULL
          AND EXISTS (SELECT 1 FROM mcp_oauth_tokens t WHERE t.grant_id = g.id
                       AND t.revoked_at IS NULL AND t.expires_at > now())
        ORDER BY g.created_at DESC`,
      [userId],
    );
    return rows.map((r) => ({
      id: r.id,
      clientName: r.client_name,
      clientUri: r.client_uri,
      tenantId: r.tenant_id,
      organizationName: r.organization_name,
      scope: r.scope,
      createdAt: new Date(r.created_at).toISOString(),
      lastUsedAt: r.last_used_at ? new Date(r.last_used_at).toISOString() : null,
    }));
  }

  async revokeGrantForUser(userId: string, grantId: string): Promise<boolean> {
    const rows: { tenant_id: string }[] = await this.dataSource.query(
      `SELECT tenant_id FROM mcp_oauth_grants WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
      [grantId, userId],
    );
    if (!rows[0]) return false;
    await this.dataSource.transaction((m) => this.revokeGrantTx(m, grantId));
    await this.auditGrant(rows[0].tenant_id, userId, 'channel.oauth.revoke', grantId, {});
    return true;
  }

  private async auditGrant(
    tenantId: string,
    userId: string,
    action: string,
    grantId: string,
    context: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.context.runInTenant(tenantId, async () => {
        this.context.setActor(userId);
        await this.audit.record({
          action,
          targetType: 'mcp_oauth_grant',
          targetId: grantId,
          context: { channel: 'mcp', ...context },
        });
      });
    } catch (err) {
      this.logger.warn(`Audit ${action} selhal: ${(err as Error).message}`);
    }
  }
}
