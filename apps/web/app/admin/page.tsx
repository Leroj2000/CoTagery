import Link from 'next/link';
import { getMe, apiFetch } from '../lib/server-api';
import { NAV_ITEMS } from './nav-items';
import { Section } from './ui';

export const dynamic = 'force-dynamic';

interface Overview {
  totalObjects: number;
  totalCarriers: number;
  totalScans: number;
  scansByModule: { moduleType: string; count: number }[];
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-neutral-500">{label}</p>
    </div>
  );
}

/** Admin dashboard – analytics přehled (EPIC-07) + rozcestník na moduly. */
export default async function AdminDashboard() {
  const [me, overview] = await Promise.all([getMe(), apiFetch<Overview>('/analytics/overview')]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Přehled</h1>
        <p className="text-sm text-neutral-500">
          Přihlášen jako {me.user.email} · tenant {me.tenantId.slice(0, 8)}…
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Objekty" value={overview.totalObjects} />
        <Stat label="Nosiče" value={overview.totalCarriers} />
        <Stat label="Skeny" value={overview.totalScans} />
      </div>

      <Section title="Skeny podle modulu">
        {overview.scansByModule.length === 0 ? (
          <p className="text-sm text-neutral-400">Zatím žádné skeny.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {overview.scansByModule.map((s) => {
              const max = Math.max(...overview.scansByModule.map((x) => x.count), 1);
              return (
                <li key={s.moduleType} className="flex items-center gap-3 text-sm">
                  <span className="w-28 shrink-0 text-neutral-600">{s.moduleType}</span>
                  <span className="h-4 flex-1 overflow-hidden rounded bg-neutral-100">
                    <span
                      className="block h-full rounded bg-neutral-800"
                      style={{ width: `${(s.count / max) * 100}%` }}
                    />
                  </span>
                  <span className="w-10 shrink-0 text-right font-medium">{s.count}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {NAV_ITEMS.filter((i) => i.href !== '/admin').map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-400"
          >
            <p className="font-medium">{item.label}</p>
            <p className="mt-1 text-xs text-neutral-500">Otevřít modul</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
