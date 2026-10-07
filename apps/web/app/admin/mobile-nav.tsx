'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sun, Search, ScanLine, UserRound } from 'lucide-react';

interface MenuUser {
  initials: string;
  name: string;
  email: string;
  role: string;
}

/**
 * Spodní mobilní lišta (< lg). Poslední záložka „Moje" neotevírá stránku, ale
 * celoobrazovkové menu nad lištou (profil, organizace, navigace, odhlášení) –
 * mobilní hlavička tak drží jen logo. Menu se zavře změnou routy, opětovným
 * klepnutím na „Moje" nebo klávesou Escape.
 */
export function MobileNav({
  hidden = [],
  user,
  menu,
}: {
  hidden?: string[];
  user: MenuUser;
  menu: ReactNode;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [path]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [open]);

  const links = [
    { href: '/admin', label: 'Dnes', icon: Sun },
    { href: '/admin/find', label: 'Najít', icon: Search },
    { href: '/admin/scan', label: 'Skenovat', icon: ScanLine },
  ];
  const tab = (active: boolean) =>
    `flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold ${active ? 'text-brand-700 bg-brand-50' : 'text-slate-600'}`;

  return (
    <>
      {open && (
        <div
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Moje menu"
          className="fixed inset-x-0 top-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-50 overflow-y-auto bg-white px-4 pb-6 pt-5 sm:px-6 lg:hidden"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
              {user.initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-slate-900">{user.name}</p>
              <p className="truncate text-xs text-slate-400">{user.email}</p>
            </div>
            <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-200">
              {user.role}
            </span>
          </div>
          {menu}
        </div>
      )}

      <nav
        aria-label="Hlavní mobilní navigace"
        className="fixed inset-x-0 bottom-0 z-50 grid auto-cols-fr grid-flow-col border-t border-slate-200 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        {links
          .filter((item) => !hidden.includes(item.href))
          .map(({ href, label, icon: Icon }) => {
            const active = !open && (href === '/admin' ? path === href : path.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={tab(active)}
              >
                <Icon size={22} />
                {label}
              </Link>
            );
          })}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          className={tab(open || path.startsWith('/admin/me'))}
        >
          <UserRound size={22} />
          Moje
        </button>
      </nav>
    </>
  );
}
