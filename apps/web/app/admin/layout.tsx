import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getMe } from '../lib/server-api';
import { AdminNav } from './nav';
import { LogoutButton } from './logout-button';

/**
 * Chráněný admin shell (server component). Middleware zajistí platnou session
 * (refresh); zde načteme profil pro topbar. Když /me selže (např. odvolaná
 * session), přesměrujeme na login.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  let me;
  try {
    me = await getMe();
  } catch {
    redirect('/login');
  }

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[220px_1fr]">
      <aside className="border-b border-neutral-200 bg-white p-4 md:border-b-0 md:border-r">
        <div className="mb-6">
          <p className="text-lg font-semibold">Tagery</p>
          <p className="text-xs text-neutral-500">Admin</p>
        </div>
        <AdminNav />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-3">
          <div className="text-sm">
            <span className="font-medium">{me.user.name}</span>
            <span className="ml-2 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
              {me.tenantRole}
            </span>
          </div>
          <LogoutButton />
        </header>
        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
