'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sun, Search, ScanLine, UserRound } from 'lucide-react';

export function MobileNav({ hidden = [] }: { hidden?: string[] }) {
  const path = usePathname();
  const links = [
    { href: '/admin', label: 'Dnes', icon: Sun },
    { href: '/admin/find', label: 'Najít', icon: Search },
    { href: '/admin/scan', label: 'Skenovat', icon: ScanLine },
    { href: '/admin/me', label: 'Moje', icon: UserRound },
  ];
  return (
    <nav
      aria-label="Hlavní mobilní navigace"
      className="fixed inset-x-0 bottom-0 z-30 grid auto-cols-fr grid-flow-col border-t border-slate-200 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      {links
        .filter((item) => !hidden.includes(item.href))
        .map(({ href, label, icon: Icon }) => {
          const active = href === '/admin' ? path === href : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold ${active ? 'text-brand-700 bg-brand-50' : 'text-slate-600'}`}
            >
              <Icon size={22} />
              {label}
            </Link>
          );
        })}
    </nav>
  );
}
