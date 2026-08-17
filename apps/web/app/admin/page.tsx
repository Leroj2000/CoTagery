import Link from 'next/link';
import { Boxes, QrCode, ScanLine, ArrowRight } from 'lucide-react';
import { getMe, apiFetch } from '../lib/server-api';
import { NAV_ITEMS } from './nav-items';
import { Section, StatCard, PageHeader, EmptyState } from './ui';

export const dynamic = 'force-dynamic';

interface Overview {
  totalObjects: number;
  totalCarriers: number;
  totalScans: number;
  scansByModule: { moduleType: string; count: number }[];
}

/** Admin dashboard – analytics přehled (EPIC-07) + rozcestník na moduly. */
export default async function AdminDashboard() {
  const [me, overview] = await Promise.all([getMe(), apiFetch<Overview>('/analytics/overview')]);
  const max = Math.max(...overview.scansByModule.map((x) => x.count), 1);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Přehled"
        description={`Vítej zpět, ${me.user.name.split(' ')[0]} — souhrn tvého tenantu.`}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Digitální objekty" value={overview.totalObjects} icon={<Boxes size={20} />} />
        <StatCard label="Identifikátory (QR/NFC)" value={overview.totalCarriers} icon={<QrCode size={20} />} />
        <StatCard label="Skeny celkem" value={overview.totalScans} icon={<ScanLine size={20} />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Skeny podle modulu" description="Rozložení naskenování napříč moduly">
          {overview.scansByModule.length === 0 ? (
            <EmptyState>Zatím žádné skeny.</EmptyState>
          ) : (
            <ul className="flex flex-col gap-3">
              {overview.scansByModule.map((s) => (
                <li key={s.moduleType} className="flex items-center gap-3 text-sm">
                  <span className="w-24 shrink-0 capitalize text-slate-600">{s.moduleType}</span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600"
                      style={{ width: `${(s.count / max) * 100}%` }}
                    />
                  </span>
                  <span className="w-8 shrink-0 text-right font-semibold text-slate-900">{s.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Moduly" description="Rychlý přístup do sekcí administrace">
          <div className="grid gap-2 sm:grid-cols-2">
            {NAV_ITEMS.filter((i) => i.href !== '/admin').map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-brand-300 hover:bg-brand-50/40"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <item.icon size={17} />
                </span>
                <span className="flex-1 text-sm font-medium text-slate-700">{item.label}</span>
                <ArrowRight size={15} className="text-slate-300 transition group-hover:text-brand-500" />
              </Link>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
