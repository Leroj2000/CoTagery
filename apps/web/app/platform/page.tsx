import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Building2, Boxes, Users } from 'lucide-react';
import { apiBase, getAccessToken } from '../lib/session';
import { getMe } from '../lib/server-api';
import { Logo } from '../ui/logo';
import { LogoutButton } from '../admin/logout-button';
import { CreateTenant } from './create-tenant';

export const dynamic = 'force-dynamic';

interface TenantSummary {
  id: string;
  name: string;
  type: string;
  slug: string | null;
  userCount: number;
  assetCount: number;
  createdAt: string;
}

async function loadTenants(): Promise<TenantSummary[]> {
  const token = await getAccessToken();
  if (!token) return [];
  const res = await fetch(`${apiBase()}/api/v1/platform/tenants`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return [];
  return (await res.json()) as TenantSummary[];
}

export default async function PlatformPage() {
  // Guard: jen platform-admin (mimo tenant /admin). Jinak zpět do /admin nebo login.
  const me = await getMe().catch(() => null);
  if (!me) redirect('/login?from=/platform');
  if (!me.isPlatformAdmin) redirect('/admin');

  const tenants = await loadTenants();

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-5">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-medium text-white">Platforma</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-700">
            ← Zpět do administrace
          </Link>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 p-5 sm:p-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-slate-900">Firmy na Tagery</h1>
          <p className="text-sm text-slate-500">Přehled a zakládání firem (jen platform-admin).</p>
        </div>

        <div className="mb-6">
          <CreateTenant />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Building2 size={16} /> Firmy
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{tenants.length}</span>
          </div>
          {tenants.length === 0 ? (
            <p className="text-sm text-slate-400">Zatím žádné firmy.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <th className="py-2 pr-3 font-medium">Firma</th>
                    <th className="py-2 pr-3 font-medium">Typ</th>
                    <th className="py-2 pr-3 font-medium">Uživatelé</th>
                    <th className="py-2 pr-3 font-medium">Položky</th>
                    <th className="py-2 pr-3 font-medium">Půjčovna</th>
                    <th className="py-2 font-medium">Založeno</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t) => (
                    <tr key={t.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 pr-3">
                        <div className="font-medium text-slate-900">{t.name}</div>
                        {t.slug && <div className="text-xs text-slate-400">/{t.slug}</div>}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-600">{t.type}</td>
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
                      <td className="py-2.5 pr-3">
                        {t.slug ? (
                          <a
                            href={`/pujcovna/${t.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand-700 hover:underline"
                          >
                            /pujcovna/{t.slug}
                          </a>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="py-2.5 text-slate-500">{t.createdAt.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
