'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_ITEMS } from './nav-items';

/** Aktivní, když je to přesná shoda, nebo podstránka (kromě rootu /admin). */
function isActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(href + '/');
}

export function AdminNav({
  orientation = 'vertical',
  hidden = [],
}: {
  orientation?: 'vertical' | 'horizontal';
  hidden?: string[];
}) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((i) => !hidden.includes(i.href));

  if (orientation === 'horizontal') {
    return (
      <nav className="flex gap-1 overflow-x-auto">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                active ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <item.icon size={15} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
              active
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <item.icon
              size={17}
              className={active ? 'text-white' : 'text-slate-400 group-hover:text-brand-600'}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
