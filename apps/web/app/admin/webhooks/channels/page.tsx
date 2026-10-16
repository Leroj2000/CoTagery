import { Bot, Link2, Send } from 'lucide-react';
import { apiFetch, getMyPermissions } from '../../../lib/server-api';
import {
  CHANNEL_LABELS,
  mcpEndpoint,
  type ChannelIdentityDto,
  type McpTokenDto,
  type OAuthGrantDto,
} from '../../../lib/channels';
import { ActionButton } from '../../action-button';
import { getActiveModules } from '../../module-access';
import { IntegrationsTabs } from '../integrations-tabs';
import { Badge, EmptyState, Mono, PageHeader, Section, Table } from '../../ui';
import { revokeChannelIdentity, revokeMcpToken, revokeOAuthGrant } from './actions';
import { CopyField } from './copy-field';
import { McpTokenForm } from './mcp-token-form';
import { TelegramLink } from './telegram-link';

export const dynamic = 'force-dynamic';

function fmt(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleString('cs-CZ', { dateStyle: 'short', timeStyle: 'short' })
    : '–';
}

function NotInPlan({ what }: { what: string }) {
  return (
    <EmptyState>
      {what} není součástí předplatného této firmy (nebo ho vlastník vypnul). Zapnout ho lze v
      Nastavení → Předplatné.
    </EmptyState>
  );
}

/**
 * EPIC-22: propojení Telegramu a AI asistentů (MCP) s účtem uživatele.
 * Jde o osobní nastavení – vidí ho každý přihlášený, funkce se řídí předplatným firmy.
 */
export default async function ChannelsPage() {
  const [active, permissions] = await Promise.all([getActiveModules(), getMyPermissions()]);
  const telegram = active.has('channel_telegram');
  const mcp = active.has('channel_mcp');
  const [identities, tokens] = await Promise.all([
    apiFetch<ChannelIdentityDto[]>('/channels/identities').catch(() => []),
    apiFetch<McpTokenDto[]>('/channels/mcp-tokens').catch(() => []),
  ]);
  const grants = await apiFetch<OAuthGrantDto[]>('/channels/oauth-grants').catch(() => []);
  const endpoint = mcpEndpoint(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Propojené kanály"
        description="Ovládej Tagery z Telegramu nebo z AI asistenta (Claude, ChatGPT). Platí stejná oprávnění jako na webu a změny se před provedením potvrzují."
        icon={<Link2 size={18} />}
      />
      <IntegrationsTabs
        current="channels"
        canManageWebhooks={permissions.has('core.integration.manage')}
      />

      <Section
        title={
          <span className="inline-flex items-center gap-2">
            <Send size={15} /> Telegram
          </span>
        }
        description="Hledání položek, co vyžaduje pozornost a zakládání položek přímo z chatu."
      >
        {telegram ? (
          <div className="flex flex-col gap-5">
            <TelegramLink />
            {identities.length === 0 ? (
              <EmptyState>Zatím nemáš propojený žádný chat.</EmptyState>
            ) : (
              <Table
                head={['Kanál', 'Účet', 'Propojeno', 'Naposledy', '']}
                rows={identities.map((i) => [
                  <Badge key="c" tone="brand">
                    {CHANNEL_LABELS[i.channel] ?? i.channel}
                  </Badge>,
                  i.displayName ?? '–',
                  fmt(i.createdAt),
                  fmt(i.lastSeenAt),
                  <ActionButton
                    key="r"
                    action={revokeChannelIdentity}
                    hidden={{ id: i.id }}
                    label="Odpojit"
                    variant="danger"
                    confirm="Odpojit tento chat od účtu?"
                  />,
                ])}
              />
            )}
          </div>
        ) : (
          <NotInPlan what="Telegram bot" />
        )}
      </Section>

      <Section
        title={
          <span className="inline-flex items-center gap-2">
            <Bot size={15} /> AI asistenti (MCP)
          </span>
        }
        description="Osobní přístupový token pro AI asistenta. Token platí jen pro aktuálně vybranou firmu a jen s tvými oprávněními."
      >
        {mcp ? (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-3">
              <p className="text-sm font-medium text-slate-800">Připojené aplikace (OAuth)</p>
              {grants.length === 0 ? (
                <EmptyState>
                  Zatím žádná. ChatGPT nebo Claude připojíš přidáním konektoru s adresou níže –
                  přihlášení a výběr firmy proběhne tady v Tagery.
                </EmptyState>
              ) : (
                <Table
                  head={['Aplikace', 'Firma', 'Povoleno', 'Naposledy použita', '']}
                  rows={grants.map((g) => [
                    g.clientName,
                    g.organizationName ?? '–',
                    fmt(g.createdAt),
                    fmt(g.lastUsedAt),
                    <ActionButton
                      key="r"
                      action={revokeOAuthGrant}
                      hidden={{ id: g.id }}
                      label="Zrušit přístup"
                      variant="danger"
                      confirm="Zrušit přístup této aplikace? Bude se muset znovu připojit."
                    />,
                  ])}
                />
              )}
            </div>
            <p className="text-sm font-medium text-slate-800">Osobní tokeny</p>
            <McpTokenForm endpoint={endpoint} />
            {tokens.length === 0 ? (
              <EmptyState>Zatím nemáš žádný token.</EmptyState>
            ) : (
              <Table
                head={['Název', 'Firma', 'Token', 'Platí do', 'Naposledy použit', '']}
                rows={tokens.map((t) => [
                  t.name,
                  t.organizationName ?? '–',
                  <Mono key="p">{t.tokenPrefix}…</Mono>,
                  t.expiresAt ? fmt(t.expiresAt) : 'bez expirace',
                  fmt(t.lastUsedAt),
                  <ActionButton
                    key="r"
                    action={revokeMcpToken}
                    hidden={{ id: t.id }}
                    label="Zrušit"
                    variant="danger"
                    confirm="Zrušit token? Asistent, který ho používá, ztratí přístup."
                  />,
                ])}
              />
            )}
            <div className="flex flex-col gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-700 ring-1 ring-inset ring-slate-200">
              <p className="font-medium text-slate-800">Jak asistenta připojit</p>
              <CopyField label="Adresa MCP serveru (Streamable HTTP)" value={endpoint} />
              <ol className="list-decimal space-y-1.5 pl-5 text-xs text-slate-600">
                <li>
                  <strong>ChatGPT</strong>: Nastavení → Konektory (Aplikace) → Vytvořit, adresa
                  výše, ověření <strong>OAuth</strong>. Client ID ani secret nevyplňuj – ChatGPT se
                  zaregistruje sám. Pak se přihlásíš do Tagery a vybereš firmu.
                </li>
                <li>
                  <strong>Claude</strong>: Nastavení → Konektory → Přidat vlastní konektor s adresou
                  výše; přihlášení proběhne stejně přes Tagery.
                </li>
                <li>
                  Klienti bez OAuth (např. skripty) použijí osobní token:{' '}
                  <Mono>Authorization: Bearer TVŮJ_TOKEN</Mono>, v Claude Code{' '}
                  <Mono>
                    claude mcp add --transport http tagery {endpoint} --header &quot;Authorization:
                    Bearer TVŮJ_TOKEN&quot;
                  </Mono>
                  .
                </li>
                <li>
                  Akce, které mění data (založení, přesun, závada), asistent před provedením
                  potvrzuje s tebou. Přístup aplikace i token můžeš kdykoli zrušit tady.
                </li>
              </ol>
            </div>
          </div>
        ) : (
          <NotInPlan what="Připojení AI asistentů" />
        )}
      </Section>
    </div>
  );
}
