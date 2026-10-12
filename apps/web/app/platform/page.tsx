import Link from 'next/link';
import { Boxes, Building2, Pencil, Users } from 'lucide-react';
import { SUBSCRIPTION_STATUS_LABELS } from '@tagery/shared';
import { apiFetch } from '../lib/server-api';
import { STATUS_TONE, fmtDay, type TenantSummary } from '../lib/platform';
import { Badge } from '../admin/ui';
import { CreateTenant } from './create-tenant';
import { PlatformShell, requirePlatformAdmin } from './platform-shell';

export const dynamic = 'force-dynamic';

export default async function PlatformPage() {
  // Guard: jen platform-admin (mimo tenant /admin). Jinak zpět do /admin nebo login.
  await requirePlatformAdmin('/platform');
  const tenants = await apiFetch<TenantSummary[]>('/platform/tenants').catch(
    () => [] as TenantSummary[],
  );

  return (
    <PlatformShell active="/platform">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Firmy na Tagery</h1>
        <p className="text-sm text-slate-500">
          Přehled firem, jejich předplatné a zakládání nových (jen platform-admin).
        </p>
      </div>

      <div className="mb-6">
        <CreateTenant />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Building2 size={16} /> Firmy
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
            {tenants.length}
          </span>
        </div>
        {tenants.length === 0 ? (
          <p className="text-sm text-slate-400">Zatím žádné firmy.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-2 pr-3 font-medium">Firma</th>
                  <th className="py-2 pr-3 font-medium">Předplatné</th>
                  <th className="py-2 pr-3 font-medium">Uživatelé</th>
                  <th className="py-2 pr-3 font-medium">Položky</th>
                  <th className="py-2 pr-3 font-medium">Založeno</th>
                  <th className="py-2 font-medium">
                    <span className="sr-only">Upravit</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2.5 pr-3">
                      <Link
                        href={`/platform/tenants/${t.id}`}
                        className="font-medium text-slate-900 hover:text-brand-700 hover:underline"
                      >
                        {t.name}
                      </Link>
                      {t.slug && <div className="text-xs text-slate-400">/{t.slug}</div>}
                    </td>
                    <td className="py-2.5 pr-3">
                      {t.subscriptionStatus ? (
                        <div className="flex flex-col items-start gap-0.5">
                          <span className="flex items-center gap-1.5">
                            <span className="font-medium text-slate-800">{t.planName}</span>
                            <Badge tone={STATUS_TONE[t.subscriptionStatus]}>
                              {SUBSCRIPTION_STATUS_LABELS[t.subscriptionStatus]}
                            </Badge>
                          </span>
                          {t.periodEnd && (
                            <span className="text-xs text-slate-400">do {fmtDay(t.periodEnd)}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="inline-flex items-center gap-1 text-slate-600">
                        <Users size={13} className="text-slate-400" /> {t.userCount}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="inline-flex items-center gap-1 text-slate-600">
                        <Boxes size={13} className="text-slate-400" /> {t.assetCount}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-slate-500">{fmtDay(t.createdAt)}</td>
                    <td className="py-2.5 text-right">
                      <Link
                        href={`/platform/tenants/${t.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                        aria-label={`Upravit firmu ${t.name}`}
                      >
                        <Pencil size={13} /> Upravit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PlatformShell>
  );
}
