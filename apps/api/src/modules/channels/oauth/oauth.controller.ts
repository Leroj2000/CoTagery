import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../../core/auth/decorators';
import { JwtAuthGuard, type RequestUser } from '../../../core/auth/jwt-auth.guard';
import { PermissionsGuard } from '../../../core/rbac/permissions.guard';
import { AllowAuthenticatedOnly } from '../../../core/rbac/require-permission.decorator';
import { RateLimitService } from '../../../core/resolver/rate-limit.service';
import { OAuthError, OAuthService, type AuthorizeParams, type ClientAuth } from './oauth.service';

/** Minimální rozhraní odpovědi (bez závislosti na typech express). */
export interface HttpResponse {
  status(code: number): HttpResponse;
  setHeader(name: string, value: string): unknown;
  json(body: unknown): unknown;
  end(): unknown;
}

interface HttpRequest {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
}

function clientIp(req: HttpRequest): string {
  const real = req.headers['x-real-ip'];
  return (Array.isArray(real) ? real[0] : real) ?? req.ip ?? 'unknown';
}

/** Ověření klienta z hlavičky Basic nebo z těla (RFC 6749 §2.3.1). */
export function parseClientAuth(
  authorization: string | undefined,
  body: Record<string, string | undefined>,
): ClientAuth {
  const basic = /^Basic\s+(\S+)$/i.exec(authorization ?? '')?.[1];
  if (basic) {
    const decoded = Buffer.from(basic, 'base64').toString('utf8');
    const i = decoded.indexOf(':');
    if (i > 0) {
      return {
        clientId: decodeURIComponent(decoded.slice(0, i)),
        clientSecret: decodeURIComponent(decoded.slice(i + 1)),
        method: 'client_secret_basic',
      };
    }
  }
  if (body.client_secret) {
    return {
      clientId: body.client_id,
      clientSecret: body.client_secret,
      method: 'client_secret_post',
    };
  }
  return { clientId: body.client_id, method: 'none' };
}

function sendOAuthError(res: HttpResponse, err: unknown): void {
  if (err instanceof OAuthError) {
    if (err.status === 401) res.setHeader('WWW-Authenticate', 'Basic realm="tagery-oauth"');
    res.status(err.status).json({ error: err.error, error_description: err.description });
    return;
  }
  throw err;
}

function noStore(res: HttpResponse): void {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
}

function cors(res: HttpResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
}

/**
 * Veřejné OAuth endpointy (mimo prefix /api/v1, viz main.ts): metadata
 * (RFC 9728, RFC 8414), dynamická registrace (RFC 7591), token a revokace.
 * Samotný autorizační endpoint `/oauth/authorize` je stránka webu (souhlas).
 */
@Controller()
export class OAuthPublicController {
  constructor(
    private readonly oauth: OAuthService,
    private readonly rateLimit: RateLimitService,
  ) {}

  @Get('.well-known/oauth-protected-resource')
  protectedResource(@Res({ passthrough: true }) res: HttpResponse) {
    cors(res);
    return this.oauth.protectedResourceMetadata();
  }

  @Get('.well-known/oauth-protected-resource/mcp')
  protectedResourceMcp(@Res({ passthrough: true }) res: HttpResponse) {
    cors(res);
    return this.oauth.protectedResourceMetadata();
  }

  @Get('.well-known/oauth-authorization-server')
  authorizationServer(@Res({ passthrough: true }) res: HttpResponse) {
    cors(res);
    return this.oauth.authorizationServerMetadata();
  }

  @Post('oauth/register')
  async register(
    @Body() body: Record<string, unknown>,
    @Req() req: HttpRequest,
    @Res() res: HttpResponse,
  ): Promise<void> {
    cors(res);
    noStore(res);
    const ip = clientIp(req);
    if (!(await this.rateLimit.allow(`oauth:register:${ip}`, 20, 3600))) {
      res.status(429).json({ error: 'slow_down', error_description: 'Too many registrations' });
      return;
    }
    try {
      res.status(201).json(await this.oauth.registerClient(body ?? {}, ip));
    } catch (err) {
      sendOAuthError(res, err);
    }
  }

  @Post('oauth/token')
  async token(
    @Body() body: Record<string, string | undefined>,
    @Headers('authorization') authorization: string | undefined,
    @Req() req: HttpRequest,
    @Res() res: HttpResponse,
  ): Promise<void> {
    cors(res);
    noStore(res);
    if (!(await this.rateLimit.allow(`oauth:token:${clientIp(req)}`, 60, 60))) {
      res.status(429).json({ error: 'slow_down', error_description: 'Too many requests' });
      return;
    }
    try {
      const auth = parseClientAuth(authorization, body ?? {});
      res.status(200).json(await this.oauth.token(body ?? {}, auth));
    } catch (err) {
      sendOAuthError(res, err);
    }
  }

  @Post('oauth/revoke')
  async revoke(
    @Body() body: Record<string, string | undefined>,
    @Headers('authorization') authorization: string | undefined,
    @Res() res: HttpResponse,
  ): Promise<void> {
    cors(res);
    noStore(res);
    try {
      await this.oauth.revokeToken(body?.token, parseClientAuth(authorization, body ?? {}));
      res.status(200).json({});
    } catch (err) {
      sendOAuthError(res, err);
    }
  }
}

const AUTHORIZE_KEYS: (keyof AuthorizeParams)[] = [
  'response_type',
  'client_id',
  'redirect_uri',
  'code_challenge',
  'code_challenge_method',
  'scope',
  'state',
  'resource',
];

function pickAuthorize(src: Record<string, unknown>): AuthorizeParams {
  const out: AuthorizeParams = {};
  for (const k of AUTHORIZE_KEYS) {
    const v = src[k];
    if (typeof v === 'string') out[k] = v.slice(0, 2000);
  }
  return out;
}

/**
 * Interní endpointy pro stránku souhlasu na webu (`/api/v1/oauth/...`, JWT
 * přihlášeného uživatele) a správa povolených aplikací v Propojených kanálech.
 */
@Controller()
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OAuthConsentController {
  constructor(
    private readonly oauth: OAuthService,
    private readonly rateLimit: RateLimitService,
  ) {}

  @Get('oauth/authorize/check')
  @AllowAuthenticatedOnly()
  check(@Query() query: Record<string, unknown>) {
    return this.oauth.checkAuthorize(pickAuthorize(query));
  }

  @Post('oauth/authorize/decision')
  @AllowAuthenticatedOnly()
  @HttpCode(200)
  async decision(
    @CurrentUser() user: RequestUser,
    @Body() body: Record<string, unknown>,
    @Res() res: HttpResponse,
  ): Promise<void> {
    if (!(await this.rateLimit.allow(`oauth:decision:${user.userId}`, 30, 600))) {
      res.status(429).json({ message: 'Příliš mnoho pokusů, zkus to za chvíli.' });
      return;
    }
    try {
      const result = await this.oauth.decide(user.userId, {
        ...pickAuthorize(body ?? {}),
        tenantId: typeof body?.tenantId === 'string' ? body.tenantId : undefined,
        decision: typeof body?.decision === 'string' ? body.decision : undefined,
      });
      res.status(200).json(result);
    } catch (err) {
      if (err instanceof OAuthError) {
        res.status(err.status).json({ message: err.description, error: err.error });
        return;
      }
      throw err;
    }
  }

  @Get('channels/oauth-grants')
  @AllowAuthenticatedOnly()
  grants(@CurrentUser() user: RequestUser) {
    return this.oauth.listGrants(user.userId);
  }

  @Delete('channels/oauth-grants/:id')
  @AllowAuthenticatedOnly()
  @HttpCode(204)
  async revokeGrant(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    if (!(await this.oauth.revokeGrantForUser(user.userId, id))) {
      throw new NotFoundException('Povolení nenalezeno');
    }
  }
}
