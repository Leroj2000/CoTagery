import Link from 'next/link';
import type { ReactNode } from 'react';
import { ScanLine, Store, KeyRound, ArrowRight } from 'lucide-react';
import { getMe, apiFetch } from '../lib/server-api';
import { NAV_ITEMS } from './nav-items';
import { Section, PageHeader, EmptyState } from './ui';

export const dynamic = 'force-dynamic';

interface Overview {
  totalObjects: number;
  totalCarriers: number;
  totalScans: number;
  scansByModule: { moduleType: string; count: number }[];
}

interface ModuleState {
  moduleKey: string;
  state: 'active' | 'inactive';
}

/** Stavy objednávek půjčovny, které vyžadují pozornost majitele (badge). */
const RENTAL_PENDING = new Set(['awaiting_payment', 'paid', 'confirmed', 'picked_up', 'returned']);

/** Velká akční dlaždice na dashboardu (rozcestník na klíčové akce). */
function ActionTile({
  href,
  icon,
  title,
  subtitle,
  badge,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="group relative flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card transition hover:border-brand-300 hover:shadow-elevate"
    >
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition group-hover:bg-brand-100">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-base font-semibold text-slate-900">{title}</span>
          {badge != null && badge > 0 && (
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-xs font-bold text-white">
              {badge}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-sm text-slate-500">{subtitle}</span>
      </span>
      <ArrowRight size={18} className="text-slate-300 transition group-hover:text-brand-500" />
    </Link>
  );
}

/** Admin dashboard – akční dlaždice + analytics přehled (EPIC-07) + rozcestník. */
export default async function AdminDashboard() {
  const [me, overview, rentalOrders, modules] = await Promise.all([
    getMe(),
    apiFetch<Overview>('/analytics/overview'),
    apiFetch<{ status: string }[]>('/rental-orders').catch(() => [] as { status: string }[]),
    apiFetch<ModuleState[]>('/modules').catch(() => [] as ModuleState[]),
  ]);
  const max = Math.max(...overview.scansByModule.map((x) => x.count), 1);
  const rentalPending = rentalOrders.filter((o) => RENTAL_PENDING.has(o.status)).length;
  const inactiveModules = new Set(
    modules.filter((m) => m.state === 'inactive').map((m) => m.moduleKey),
  );
  const visibleNavItems = NAV_ITEMS.filter(
    (item) => item.href !== '/admin' && (!item.moduleKey || !inactiveModules.has(item.moduleKey)),
  );
  const rentalActive = !inactiveModules.has('rental');

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Přehled"
        description={`Vítej zpět, ${me.user.name.split(' ')[0]} — souhrn tvého tenantu.`}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <ActionTile
          href="/admin/scan"
          icon={<ScanLine size={26} />}
          title="Identifikovat"
          subtitle="Naskenuj QR / kód"
        />
        {rentalActive && (
          <ActionTile
            href="/admin/rental"
            icon={<Store size={26} />}
            title="Půjčovna"
            subtitle="Objednávky a výpůjčky"
            badge={rentalPending}
          />
        )}
        <ActionTile
          href="/admin/klicenka"
          icon={<KeyRound size={26} />}
          title="Klíčenka"
          subtitle="Slevové a přístupové kódy"
        />
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
                  <span className="w-8 shrink-0 text-right font-semibold text-slate-900">
                    {s.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Moduly" description="Rychlý přístup do sekcí administrace">
          <div className="grid gap-2 sm:grid-cols-2">
            {visibleNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-brand-300 hover:bg-brand-50/40"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <item.icon size={17} />
                </span>
                <span className="flex-1 text-sm font-medium text-slate-700">{item.label}</span>
                <ArrowRight
                  size={15}
                  className="text-slate-300 transition group-hover:text-brand-500"
                />
              </Link>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
