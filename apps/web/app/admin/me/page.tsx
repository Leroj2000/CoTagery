import Link from 'next/link';
import { apiFetch, getMyPermissions } from '../../lib/server-api';
import type { Asset } from '../../lib/types';
import { EmptyState, PageHeader, Section, StatusBadge } from '../ui';
import { MyWorkflows } from './my-workflows';

interface PersonalView {
  linked: boolean;
  assets: Asset[];
  pending: { id: string; assetId: string; assetName: string }[];
  requests: { id: string; assetId: string; assetName: string; status: string }[];
}
const requestStatus: Record<string, string> = {
  pending: 'Čeká na schválení',
  approved: 'Schváleno',
  fulfilled: 'Vyřízeno',
  rejected: 'Zamítnuto',
  cancelled: 'Zrušeno',
};
export default async function MyPage() {
  const perms = await getMyPermissions();
  if (!perms.has('asset.scan.use'))
    return <EmptyState>Osobní evidenci nemáš v této roli dostupnou.</EmptyState>;
  const view = await apiFetch<PersonalView>('/assets/mine');
  const workflows = await apiFetch<{
    handoffs: {
      id: string;
      assetId: string;
      assetName: string;
      incoming: boolean;
      status: string;
      recipientName: string;
    }[];
  }>('/personal-workflows/me').catch(() => ({ handoffs: [] }));
  const canView = perms.has('asset.item.view');
  const name = (id: string, title: string) =>
    canView ? (
      <Link className="font-semibold text-brand-700 hover:underline" href={`/admin/assets/${id}`}>
        {title}
      </Link>
    ) : (
      <span className="font-semibold">{title}</span>
    );
  return (
    <div className="space-y-6">
      <PageHeader
        title="Moje vybavení"
        description="Věci, které máš svěřené, čekající převzetí a tvoje požadavky."
      />
      {!view.linked ? (
        <EmptyState>
          Tvůj účet zatím není jednoznačně spojený s osobou v evidenci firmy. Požádej správce o
          kontrolu účtu a e-mailu u osoby.
        </EmptyState>
      ) : (
        <>
          <Section title={`Čeká na převzetí (${view.pending.length})`}>
            <p className="mb-3 text-sm text-slate-500">
              Samotné hledání kódem nepotvrzuje převzetí. Před potvrzením zkontroluj položku v
              detailu.
            </p>
            {view.pending.length ? (
              <ul className="divide-y divide-slate-100">
                {view.pending.map((m) => (
                  <li key={m.id} className="py-3">
                    {name(m.assetId, m.assetName)}
                    <span className="ml-3 text-xs text-amber-800">Nepotvrzené předání</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState>Žádné čekající převzetí.</EmptyState>
            )}
          </Section>
          <Section title="Připravená předání">
            <MyWorkflows handoffs={workflows.handoffs} />
          </Section>
          <Section title={`Mám u sebe (${view.assets.length})`}>
            {view.assets.length ? (
              <ul className="divide-y divide-slate-100">
                {view.assets.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-4">
                    {name(a.id, a.name)}
                    <StatusBadge status={a.status} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState>Zatím nemáš svěřenou žádnou položku.</EmptyState>
            )}
          </Section>
          <Section title="Moje požadavky">
            {view.requests.length ? (
              <ul className="divide-y divide-slate-100">
                {view.requests.map((r) => (
                  <li key={r.id} className="flex flex-wrap justify-between gap-3 py-3">
                    {name(r.assetId, r.assetName)}
                    <span className="text-sm text-slate-600">
                      {requestStatus[r.status] ?? r.status}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState>Zatím žádné požadavky.</EmptyState>
            )}
          </Section>
        </>
      )}
    </div>
  );
}
