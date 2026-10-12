import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getMe } from '../lib/server-api';
import { Logo } from '../ui/logo';
import { LogoutButton } from '../admin/logout-button';

const TABS = [
  { href: '/platform', label: 'Firmy' },
  { href: '/platform/plans', label: 'Úrovně předplatného' },
  { href: '/platform/settings', label: 'Nastavení' },
];

/** Ověří platform-admina (jinak přesměruje) – pro server stránky /platform. */
export async function requirePlatformAdmin(from: string): Promise<void> {
  const me = await getMe().catch(() => null);
  if (!me) redirect(`/login?from=${encodeURIComponent(from)}`);
  if (!me.isPlatformAdmin) redirect('/admin');
}

/** Rám stránek Platformy: hlavička, záložky, obsah. */
export function PlatformShell({
  active,
  children,
}: {
  active: '/platform' | '/platform/plans' | '/platform/settings';
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="flex h-16 items-center justify-between px-4 sm:px-5">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-medium text-white">
              Platforma
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="hidden text-sm text-slate-500 hover:text-slate-700 sm:inline"
            >
              ← Zpět do administrace
            </Link>
            <LogoutButton />
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 sm:px-4">
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition ${
                active === t.href
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl p-4 sm:p-8">{children}</main>
    </div>
  );
}
