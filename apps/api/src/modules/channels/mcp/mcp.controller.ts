import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import { RateLimitService } from '../../../core/resolver/rate-limit.service';
import { McpServerService, type JsonRpcRequest } from './mcp-server.service';
import { McpTokenService } from './mcp-token.service';
import { OAuthService } from '../oauth/oauth.service';

/** Minimální rozhraní odpovědi (bez závislosti na typech express). */
interface HttpResponse {
  status(code: number): HttpResponse;
  setHeader(name: string, value: string): unknown;
  end(): unknown;
}

/**
 * MCP endpoint `/mcp` (mimo prefix /api/v1). Autentizace: `Authorization:
 * Bearer tgm_…` (osobní token; TODO OAuth 2.1). Batch požadavky se nepodporují.
 */
@Controller('mcp')
export class McpController {
  constructor(
    private readonly server: McpServerService,
    private readonly tokens: McpTokenService,
    private readonly rateLimit: RateLimitService,
    private readonly oauth: OAuthService,
  ) {}

  @Post()
  @HttpCode(200)
  async post(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: JsonRpcRequest,
    @Res({ passthrough: true }) res: HttpResponse,
  ): Promise<unknown> {
    const bearer = /^Bearer\s+(\S+)$/i.exec(authorization ?? '')?.[1];
    const token = bearer ? await this.authenticate(bearer) : null;
    if (!token) {
      // RFC 9728 §5.1: odkaz na metadata chráněného zdroje → klient najde OAuth server.
      res.setHeader(
        'WWW-Authenticate',
        `Bearer realm="tagery-mcp", resource_metadata="${this.oauth.resourceMetadataUrl()}"` +
          (bearer ? ', error="invalid_token"' : ''),
      );
      throw new HttpException(
        { jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Unauthorized' } },
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (!(await this.rateLimit.allow(`mcp:token:${token.ref}`, 120, 60))) {
      throw new HttpException(
        { jsonrpc: '2.0', id: null, error: { code: -32029, message: 'Rate limit exceeded' } },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (Array.isArray(body)) {
      return { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Batch not supported' } };
    }
    const response = await this.server.handle(body, {
      userId: token.userId,
      channel: 'mcp',
      tenantId: token.tenantId,
      externalRef: token.ref,
    });
    if (response === null) {
      res.status(HttpStatus.ACCEPTED);
      return '';
    }
    return response;
  }

  /** OAuth access token (`tgo_`) nebo osobní token (`tgm_`). */
  private async authenticate(
    bearer: string,
  ): Promise<{ ref: string; userId: string; tenantId: string } | null> {
    if (bearer.startsWith('tgo_')) {
      const t = await this.oauth.verifyAccessToken(bearer);
      return t ? { ref: t.grantId, userId: t.userId, tenantId: t.tenantId } : null;
    }
    const t = await this.tokens.verify(bearer);
    return t ? { ref: t.id, userId: t.userId, tenantId: t.tenantId } : null;
  }

  /** Bez SSE streamu (server neposílá notifikace). */
  @Get()
  get(@Res() res: HttpResponse): void {
    res.setHeader('Allow', 'POST');
    res.status(HttpStatus.METHOD_NOT_ALLOWED).end();
  }
}
