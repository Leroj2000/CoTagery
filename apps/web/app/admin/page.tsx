import Link from 'next/link';
import { Plus, ScanLine, ArrowRight } from 'lucide-react';
import { getMe, apiFetch, getMyPermissions } from '../lib/server-api';
import { NAV_SECTIONS } from './nav-items';
import { Section, PageHeader } from './ui';

export const dynamic = 'force-dynamic';
export default async function AdminDashboard() {
  const [me, permissions, modules] = await Promise.all([
    getMe(),
    getMyPermissions(),
    apiFetch<{ moduleKey: string; state: string }[]>('/modules'),
  ]);
  const inactive = new Set(modules.filter((m) => m.state === 'inactive').map((m) => m.moduleKey));
  const attention = permissions.has('asset.item.view')
    ? await apiFetch<{
        overdue: unknown[];
        pendingConfirmations: unknown[];
        openIssues: unknown[];
        dueServices: unknown[];
      }>('/assets/attention').catch(() => null)
    : undefined;
  const tasks = attention
    ? ([
        ['Čekající převzetí', attention.pendingConfirmations.length],
        ['Položky po termínu', attention.overdue.length],
        ['Otevřené problémy', attention.openIssues.length],
        ['Servis a revize', attention.dueServices.length],
      ] as const)
    : [];
  return (
    <div className="space-y-7">
      <PageHeader
        title="Dnes"
        description={`Ahoj, ${me.user.name.split(' ')[0]}. Co dnes potřebuješ zařídit?`}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {permissions.has('asset.item.create') && (
          <Link
            href="/admin/assets/new"
            className="group flex min-h-36 items-center gap-4 rounded-2xl border border-brand-200 bg-brand-50 p-6 transition hover:border-brand-500"
          >
            <Plus size={36} className="shrink-0 text-brand-700" />
            <span>
              <span className="block text-xl font-bold text-slate-900">Přidat položku</span>
              <span className="mt-1 block text-sm text-slate-600">
                Vyfoť, označ a ulož na správné místo.
              </span>
            </span>
            <ArrowRight className="ml-auto shrink-0 text-brand-600" />
          </Link>
        )}
        {permissions.has('asset.scan.use') && (
          <Link
            href="/admin/scan"
            className="group flex min-h-36 items-center gap-4 rounded-2xl border border-brand-200 bg-brand-50 p-6 transition hover:border-brand-500"
          >
            <ScanLine size={36} className="shrink-0 text-brand-700" />
            <span>
              <span className="block text-xl font-bold text-slate-900">Identifikovat</span>
              <span className="mt-1 block text-sm text-slate-600">
                Načti kód. Najdi věc a dostupné akce.
              </span>
            </span>
            <ArrowRight className="ml-auto shrink-0 text-brand-600" />
          </Link>
        )}
      </div>
      {attention !== undefined && (
        <Section
          title="Co vyžaduje pozornost"
          description="Provozní úkoly organizace v tvém dostupném přehledu."
        >
          {attention === null ? (
            <p role="status" className="text-sm text-amber-800">
              Úkoly se nepodařilo načíst. Obnov stránku a zkus to znovu.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {tasks.map(([label, count]) => (
                <Link
                  key={label}
                  href="/admin/attention"
                  className="rounded-xl border border-slate-200 p-4 hover:border-brand-300"
                >
                  <span
                    className={`block text-3xl font-semibold ${count ? 'text-brand-700' : 'text-slate-400'}`}
                  >
                    {count}
                  </span>
                  <span className="mt-2 block text-sm text-slate-600">{label}</span>
                </Link>
              ))}
            </div>
          )}
        </Section>
      )}
      {NAV_SECTIONS.slice(0, 2).map((section, index) => {
        const items = section.items.filter(
          (item) =>
            item.href !== '/admin' &&
            item.href !== '/admin/scan' &&
            (!item.permission || permissions.has(item.permission)) &&
            (!item.moduleKey || !inactive.has(item.moduleKey)),
        );
        if (!items.length) return null;
        return (
          <Section key={index} title={section.label ?? 'Tvůj pracovní prostor'}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex min-h-16 items-center gap-3 rounded-xl border border-slate-200 p-4 text-sm font-semibold text-slate-700 hover:bg-brand-50"
                >
                  <item.icon size={21} className="text-brand-600" />
                  {item.label}
                  <ArrowRight size={17} className="ml-auto text-slate-400" />
                </Link>
              ))}
            </div>
          </Section>
        );
      })}
    </div>
  );
}
