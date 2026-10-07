'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_SECTIONS, type NavItem } from './nav-items';
import { CountBadge } from '../ui/count-badge';

/** Aktivní, když je to přesná shoda, nebo podstránka (kromě rootu /admin). */
function isActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin';
  return pathname === href || pathname.startsWith(href + '/');
}

export function AdminNav({
  orientation = 'vertical',
  hidden = [],
  counts = {},
}: {
  orientation?: 'vertical' | 'horizontal';
  hidden?: string[];
  /** Počet čekajících položek per `href` → číslo v kolečku u položky. */
  counts?: Record<string, number>;
}) {
  const pathname = usePathname();
  // Filtr skrytých položek per sekce; prázdné sekce vypadnou.
  const sections = NAV_SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter((i) => !hidden.includes(i.href)),
  })).filter((s) => s.items.length > 0);

  if (orientation === 'horizontal') {
    return (
      <nav className="flex items-center gap-1 overflow-x-auto">
        {sections.map((section, si) => (
          <div key={section.label ?? si} className="flex items-center gap-1">
            {si > 0 && <span className="mx-1 h-5 w-px shrink-0 bg-slate-200" aria-hidden />}
            {section.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    active ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <item.icon size={15} className={active ? 'text-brand-600' : undefined} />
                  {item.label}
                  <CountBadge count={counts[item.href] ?? 0} />
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    );
  }

  const renderItem = (item: NavItem) => {
    const active = isActive(pathname, item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
          active
            ? 'bg-brand-50 text-brand-700'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
      >
        <item.icon
          size={17}
          className={active ? 'text-brand-600' : 'text-slate-400 group-hover:text-brand-600'}
        />
        <span className="flex-1">{item.label}</span>
        <CountBadge count={counts[item.href] ?? 0} />
      </Link>
    );
  };

  return (
    <nav className="flex flex-col gap-4">
      {sections.map((section, si) => (
        <div key={section.label ?? si} className="flex flex-col gap-0.5">
          {section.label && (
            <p className="px-3 pb-1 pt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
              {section.label}
            </p>
          )}
          {section.items.map(renderItem)}
        </div>
      ))}
    </nav>
  );
}
