import Link from 'next/link';
import { getMe } from '../lib/server-api';
import { NAV_ITEMS } from './nav-items';

/** Admin dashboard (fáze 1) – profil + rozcestník na moduly (fáze 2+). */
export default async function AdminDashboard() {
  const me = await getMe();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Přehled</h1>
        <p className="text-sm text-neutral-500">
          Přihlášen jako {me.user.email} · tenant {me.tenantId.slice(0, 8)}…
        </p>
      </div>

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
