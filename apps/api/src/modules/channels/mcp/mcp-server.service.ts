import { Injectable } from '@nestjs/common';
import { ActionExecutorService } from '../actions/action-executor.service';
import { ActionRegistry } from '../actions/action-registry.service';
import { zodToJsonSchema } from '../actions/zod-json-schema';
import type { ChannelActor } from '../channel.types';

export const MCP_PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];

export interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

export type JsonRpcResponse =
  | { jsonrpc: '2.0'; id: string | number | null; result: unknown }
  | { jsonrpc: '2.0'; id: string | number | null; error: { code: number; message: string } };

/** MCP názvy nástrojů nesmí obsahovat tečku (`asset.search` → `asset_search`). */
export const toolName = (key: string): string => key.replace(/\./g, '_');

/**
 * Bezstavový MCP server (JSON-RPC 2.0 nad Streamable HTTP, jen JSON odpovědi,
 * bez SSE). Nástroje = ActionRegistry; volání vždy přes ActionExecutor, takže
 * platí stejná oprávnění, RLS, politiky, moduly a audit jako na webu.
 * Zápisy: potvrzení deleguje na MCP hostitele (`destructiveHint`) – viz PLAN.md.
 */
@Injectable()
export class McpServerService {
  constructor(
    private readonly registry: ActionRegistry,
    private readonly executor: ActionExecutorService,
  ) {}

  /** Vrací null pro notifikace (bez id) → HTTP 202. */
  async handle(req: JsonRpcRequest, actor: ChannelActor): Promise<JsonRpcResponse | null> {
    const id = req?.id ?? null;
    const isNotification = req?.id === undefined;
    if (req?.jsonrpc !== '2.0' || typeof req.method !== 'string') {
      return { jsonrpc: '2.0', id, error: { code: -32600, message: 'Invalid Request' } };
    }
    if (isNotification) return null;
    const ok = (result: unknown): JsonRpcResponse => ({ jsonrpc: '2.0', id, result });

    switch (req.method) {
      case 'initialize': {
        const requested = String(req.params?.protocolVersion ?? '');
        return ok({
          protocolVersion: MCP_PROTOCOL_VERSIONS.includes(requested)
            ? requested
            : MCP_PROTOCOL_VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'tagery', version: '1.0.0' },
          instructions:
            'Tagery asset management. Tools act in the organization the access token is bound to. Write tools change data – confirm with the user first.',
        });
      }
      case 'ping':
        return ok({});
      case 'tools/list':
        return ok({
          tools: this.registry.list().map((a) => ({
            name: toolName(a.key),
            title: a.title,
            description: a.description,
            inputSchema: zodToJsonSchema(a.input),
            annotations: {
              title: a.title,
              readOnlyHint: a.kind === 'read',
              destructiveHint: a.kind === 'write',
              openWorldHint: false,
            },
          })),
        });
      case 'tools/call': {
        const name = String(req.params?.name ?? '');
        const action = this.registry.list().find((a) => toolName(a.key) === name);
        if (!action) {
          return { jsonrpc: '2.0', id, error: { code: -32602, message: `Unknown tool: ${name}` } };
        }
        const result = await this.executor.execute(actor, action.key, req.params?.arguments ?? {}, {
          confirmed: true,
        });
        if (result.ok) {
          return ok({
            content: [{ type: 'text', text: JSON.stringify(result.data) }],
            structuredContent: { result: result.data },
            isError: false,
          });
        }
        return ok({
          content: [{ type: 'text', text: `${result.code}: ${result.message}` }],
          isError: true,
        });
      }
      default:
        return { jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } };
    }
  }
}
