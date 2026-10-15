import type { z } from 'zod';

/** Kontext provádění akce – vždy uvnitř `runInTenant` aktivní firmy (kromě scope `user`). */
export interface ActionExecutionContext {
  userId: string;
  tenantId: string | null;
  /** Odkaz do webu (vyžaduje přihlášení) – nikdy veřejný. */
  webUrl: (path: string) => string;
}

/**
 * Doménový „nástroj" sdílený všemi kanály (Telegram, MCP, později WhatsApp).
 * Kanály jsou jen tenké adaptéry; oprávnění, RLS, limity a audit řeší executor.
 */
export interface ChannelAction<TSchema extends z.ZodTypeAny = z.ZodTypeAny, TOut = unknown> {
  key: string;
  /** Anglický popis pro AI modely (MCP). */
  description: string;
  /** Krátký český název (zprávy bota, audit). */
  title: string;
  input: TSchema;
  /** Oprávnění z katalogu; `null` = jen platné aktivní členství (např. výpis firem). */
  permission: string | null;
  kind: 'read' | 'write';
  /** Zápis vyžaduje výslovné potvrzení uživatelem (tlačítko / MCP host). */
  requiresConfirmation: boolean;
  /** `user` = akce bez firmy (výpis firem); `tenant` = v kontextu aktivní firmy. */
  scope: 'user' | 'tenant';
  /** Lidsky čitelné shrnutí pro potvrzovací dotaz. */
  summarize?: (input: z.infer<TSchema>) => string;
  execute: (ctx: ActionExecutionContext, input: z.infer<TSchema>) => Promise<TOut>;
}

export type AnyChannelAction = ChannelAction<z.ZodTypeAny, unknown>;

export function defineAction<TSchema extends z.ZodTypeAny, TOut>(
  action: ChannelAction<TSchema, TOut>,
): AnyChannelAction {
  return action as unknown as AnyChannelAction;
}

/** Výsledek volání akce (kanály ho převádějí na zprávu / MCP odpověď). */
export type ActionResult =
  | { ok: true; key: string; data: unknown }
  | { ok: false; key: string; code: ActionErrorCode; message: string; summary?: string };

export type ActionErrorCode =
  | 'UNKNOWN_ACTION'
  | 'NO_ORGANIZATION'
  | 'INACTIVE_MEMBERSHIP'
  | 'CHANNEL_DISABLED'
  | 'MISSING_PERMISSION'
  | 'POLICY_DENIED'
  | 'OUT_OF_SCOPE'
  | 'INVALID_INPUT'
  | 'NOT_FOUND'
  | 'LIMIT_REACHED'
  | 'CONFIRMATION_REQUIRED'
  | 'FAILED';
