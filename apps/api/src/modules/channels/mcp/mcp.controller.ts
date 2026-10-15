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
  ) {}

  @Post()
  @HttpCode(200)
  async post(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: JsonRpcRequest,
    @Res({ passthrough: true }) res: HttpResponse,
  ): Promise<unknown> {
    const bearer = /^Bearer\s+(\S+)$/i.exec(authorization ?? '')?.[1];
    const token = bearer ? await this.tokens.verify(bearer) : null;
    if (!token) {
      res.setHeader('WWW-Authenticate', 'Bearer realm="tagery-mcp"');
      throw new HttpException(
        { jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Unauthorized' } },
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (!(await this.rateLimit.allow(`mcp:token:${token.id}`, 120, 60))) {
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
      externalRef: token.id,
    });
    if (response === null) {
      res.status(HttpStatus.ACCEPTED);
      return '';
    }
    return response;
  }

  /** Bez SSE streamu (server neposílá notifikace). */
  @Get()
  get(@Res() res: HttpResponse): void {
    res.setHeader('Allow', 'POST');
    res.status(HttpStatus.METHOD_NOT_ALLOWED).end();
  }
}
