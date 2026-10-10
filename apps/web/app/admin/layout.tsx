import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getMe, apiFetch, getMyPermissions } from '../lib/server-api';
import type { Attention } from '../lib/types';
import { BrandLink } from './brand-link';
import { AdminNav } from './nav';
import { NAV_ITEMS } from './nav-items';
import { LogoutButton } from './logout-button';
import { OrgSwitcher } from './org-switcher';
import { MobileNav } from './mobile-nav';

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

/** Počet položek „Vyžaduje pozornost" (stejný součet jako stránka /admin/attention). */
async function attentionCount(): Promise<number> {
  const [att, due] = await Promise.all([
    apiFetch<Attention>('/assets/attention').catch(() => null),
    apiFetch<unknown[]>('/maintenance/due').catch(() => []),
  ]);
  if (!att) return due.length;
  return (
    att.overdue.length +
    att.pendingConfirmations.length +
    att.openIssues.length +
    att.dueServices.length +
    due.length
  );
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
  const permissions = await getMyPermissions();
  const inactiveModules = new Set(
    modules.filter((m) => m.state === 'inactive').map((m) => m.moduleKey),
  );
  const hiddenNav = NAV_ITEMS.filter(
    (item) => (item.moduleKey && inactiveModules.has(item.moduleKey)) || (item.permission && !permissions.has(item.permission)),
  ).map((item) => item.href);

  // Čekající položky → čísla v kolečku v navigaci a na záložce „Menu".
  const navCounts: Record<string, number> = {};
  if (permissions.has('asset.item.view')) {
    navCounts['/admin/attention'] = await attentionCount();
  }
  const pendingTotal = Object.values(navCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_1fr]">
      {/* Sidebar (lg+) */}
      <aside className="hidden lg:flex lg:flex-col lg:border-r lg:border-slate-200 lg:bg-white">
        <div className="flex h-16 items-center border-b border-slate-100 px-5">
          <BrandLink />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <AdminNav hidden={hiddenNav} counts={navCounts} />
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
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-6 lg:bg-white/80 lg:px-8 lg:backdrop-blur">
          <div className="min-w-0 shrink lg:hidden">
            <BrandLink />
          </div>
          <div className="hidden lg:block" />

          {/* Mobil: jen přepínač firem; zbytek je v „Menu" spodní lišty */}
          <div className="min-w-0 lg:hidden">
            <OrgSwitcher current={me.tenantId} memberships={memberships} />
          </div>

          {/* Desktop: vše v řádku */}
          <div className="hidden min-w-0 items-center gap-3 lg:flex">
            {me.isPlatformAdmin && (
              <a
                href="/platform"
                className="shrink-0 rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-700"
              >
                Platforma
              </a>
            )}
            <OrgSwitcher current={me.tenantId} memberships={memberships} />
            <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-200">
              {me.roleName ?? me.tenantRole}
            </span>
            <LogoutButton />
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 pb-28 sm:p-6 sm:pb-28 lg:p-8">{children}</main>
        <MobileNav
          hidden={hiddenNav}
          badge={pendingTotal}
          user={{ initials: initials(me.user.name), name: me.user.name, email: me.user.email, role: me.roleName ?? me.tenantRole }}
          menu={
            <div className="mt-5 space-y-5">
              {me.isPlatformAdmin && (
                <a
                  href="/platform"
                  className="flex w-full items-center justify-center rounded-lg bg-slate-900 px-3 py-2.5 text-sm font-medium text-white hover:bg-slate-700"
                >
                  Platforma
                </a>
              )}
              <div>
                <p className="px-1 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  Pracovní prostor a moduly
                </p>
                <AdminNav hidden={hiddenNav} counts={navCounts} />
              </div>
              <LogoutButton block />
            </div>
          }
        />
      </div>
    </div>
  );
}
