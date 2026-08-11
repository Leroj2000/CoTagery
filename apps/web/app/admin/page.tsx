import Link from 'next/link';
import { getMe, apiFetch } from '../lib/server-api';
import { NAV_ITEMS } from './nav-items';
import { Section, Table, Badge } from './ui';

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
        <Table
          head={['Modul', 'Počet skenů']}
          rows={overview.scansByModule.map((s) => [<Badge key="m">{s.moduleType}</Badge>, s.count])}
        />
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
