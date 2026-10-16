import { redirect } from 'next/navigation';
import { AlertCircle, Bot, Check } from 'lucide-react';
import { apiFetch, ApiError, getMe } from '../../lib/server-api';
import { getAccessToken } from '../../lib/session';
import { pickOAuthParams, redirectHost, type OAuthAuthorizeCheck } from '../../lib/channels';
import { Logo } from '../../ui/logo';
import { ConsentForm } from './consent-form';

export const dynamic = 'force-dynamic';

interface Membership {
  organizationId: string;
  organizationName: string;
  status: string;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="bg-brand-radial flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo size={40} withText={false} />
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tagery</h1>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-elevate">
          {children}
        </div>
      </div>
    </main>
  );
}

/**
 * OAuth 2.1 autorizační endpoint (`/oauth/authorize`) – souhlas uživatele s
 * přístupem AI asistenta (MCP klienta) k jedné firmě. Přihlášení zajišťuje
 * middleware (bez session → /login?from=…).
 */
export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = pickOAuthParams(await searchParams);
  const qs = new URLSearchParams(params).toString();
  const loginUrl = `/login?from=${encodeURIComponent(`/oauth/authorize?${qs}`)}`;
  if (!(await getAccessToken())) redirect(loginUrl);

  let check: OAuthAuthorizeCheck;
  try {
    check = await apiFetch<OAuthAuthorizeCheck>(`/oauth/authorize/check?${qs}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) redirect(loginUrl);
    throw e;
  }
  if (!check.ok) {
    if (check.redirectTo) redirect(check.redirectTo);
    return (
      <Shell>
        <p className="flex items-start gap-2 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          Požadavek na připojení je neplatný: {check.description}
        </p>
      </Shell>
    );
  }

  const [me, memberships] = await Promise.all([
    getMe(),
    apiFetch<Membership[]>('/auth/memberships').catch(() => [] as Membership[]),
  ]);
  const orgs = memberships
    .filter((m) => m.status === 'active')
    .map((m) => ({ id: m.organizationId, name: m.organizationName }));

  return (
    <Shell>
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Bot size={20} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              {check.clientName} žádá o přístup k Tagery
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Přihlášen jako {me.user.email}. Po povolení se vrátíš na{' '}
              <span className="font-medium text-slate-700">{redirectHost(check.redirectUri)}</span>.
            </p>
          </div>
        </div>
        <ul className="flex flex-col gap-1.5 text-sm text-slate-700">
          <li className="flex items-start gap-2">
            <Check size={15} className="mt-0.5 shrink-0 text-emerald-600" />
            Hledat a zobrazovat položky, místa a to, co vyžaduje pozornost
          </li>
          <li className="flex items-start gap-2">
            <Check size={15} className="mt-0.5 shrink-0 text-emerald-600" />
            Zakládat a přesouvat položky a hlásit závady – asistent je před provedením potvrzuje
          </li>
          <li className="flex items-start gap-2">
            <Check size={15} className="mt-0.5 shrink-0 text-emerald-600" />
            Vždy jen s tvými oprávněními ve vybrané firmě (rozsah: {check.scope})
          </li>
        </ul>
        {orgs.length === 0 ? (
          <p className="text-sm text-red-700">Nemáš aktivní členství v žádné firmě.</p>
        ) : (
          <ConsentForm params={params} orgs={orgs} currentOrgId={me.tenantId} />
        )}
        <p className="text-xs text-slate-400">
          Přístup můžeš kdykoli zrušit v Integrace → Propojené kanály.
        </p>
      </div>
    </Shell>
  );
}
