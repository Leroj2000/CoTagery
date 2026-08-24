import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getMe, apiFetch } from '../lib/server-api';
import { Logo } from '../ui/logo';
import { AdminNav } from './nav';
import { LogoutButton } from './logout-button';
import { OrgSwitcher } from './org-switcher';

interface Membership {
  membershipId: string;
  organizationId: string;
  organizationName: string;
  role: string;
  status: string;
}

interface ModuleState {
  moduleKey: string;
  state: 'active' | 'inactive';
}

/** Modul → navigační cesta (skrytí vypnutých modulů, EPIC-18 Fáze 3). */
const MODULE_HREF: Record<string, string> = {
  membership: '/admin/membership',
  billing: '/admin/billing',
  access: '/admin/access',
};

/** Iniciály pro avatar. */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * Chráněný admin shell (server component). Middleware zajistí platnou session
 * (refresh); zde načteme profil pro topbar. Když /me selže, redirect na login.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  let me;
  try {
    me = await getMe();
  } catch {
    redirect('/login');
  }
  const memberships = await apiFetch<Membership[]>('/auth/memberships').catch(() => []);
  const modules = await apiFetch<ModuleState[]>('/modules').catch(() => []);
  const hiddenNav = modules
    .filter((m) => m.state === 'inactive' && MODULE_HREF[m.moduleKey])
    .map((m) => MODULE_HREF[m.moduleKey]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_1fr]">
      {/* Sidebar (lg+) */}
      <aside className="hidden lg:flex lg:flex-col lg:border-r lg:border-slate-200 lg:bg-white">
        <div className="flex h-16 items-center border-b border-slate-100 px-5">
          <Logo />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <AdminNav hidden={hiddenNav} />
        </div>
        <div className="border-t border-slate-100 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
              {initials(me.user.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-800">{me.user.name}</p>
              <p className="truncate text-xs text-slate-400">{me.user.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Hlavní sloupec */}
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white/80 px-5 backdrop-blur">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-3">
            {me.isPlatformAdmin && (
              <a
                href="/platform"
                className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-700"
              >
                Platforma
              </a>
            )}
            <OrgSwitcher current={me.tenantId} memberships={memberships} />
            <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-200">
              {me.tenantRole}
            </span>
            <LogoutButton />
          </div>
        </header>

        {/* Mobilní navigace */}
        <div className="border-b border-slate-200 bg-white px-3 py-2 lg:hidden">
          <AdminNav orientation="horizontal" hidden={hiddenNav} />
        </div>

        <main className="mx-auto w-full max-w-7xl flex-1 p-5 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
