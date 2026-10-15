import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CALENDAR_SOURCE_LABELS, type CalendarItem } from '@tagery/shared';
import {
  MONTHS,
  SOURCE_STYLES,
  WEEKDAYS,
  dayKey,
  fmtDay,
  fmtItemTime,
  fmtTime,
  itemsByDay,
  monthGrid,
} from '../lib/calendar';

/**
 * Měsíční přehled kalendáře (server-safe) – mřížka na širších displejích,
 * pod ní seznam termínů po dnech (mobile-first). Sdílí admin i veřejná stránka.
 */
export function CalendarMonth({
  year,
  month,
  items,
  prevHref,
  nextHref,
  todayHref,
  linkItems = false,
}: {
  year: number;
  month: number;
  items: CalendarItem[];
  prevHref: string;
  nextHref: string;
  todayHref: string;
  /** Zobrazit položky jako odkazy do administrace (jen přihlášený kalendář). */
  linkItems?: boolean;
}) {
  const grid = monthGrid(year, month);
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const days = new Set(grid.flat());
  const byDay = itemsByDay(items, days);
  const today = dayKey(new Date());
  const agenda = [...byDay.entries()]
    .filter(([d]) => d.startsWith(monthPrefix))
    .sort(([a], [b]) => a.localeCompare(b));

  const label = (item: CalendarItem) => {
    const time = item.allDay ? '' : `${fmtTime(item.start)} `;
    return `${time}${item.title}`;
  };

  const chip = (item: CalendarItem, compact: boolean) => {
    const cls = `block truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${SOURCE_STYLES[item.source]}`;
    const text = compact ? label(item) : item.title;
    return linkItems && item.href ? (
      <Link key={item.id} href={item.href} className={`${cls} hover:underline`} title={item.title}>
        {text}
      </Link>
    ) : (
      <span key={item.id} className={cls} title={item.title}>
        {text}
      </span>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">
          {MONTHS[month]} {year}
        </h2>
        <div className="flex items-center gap-1">
          <Link
            href={prevHref}
            aria-label="Předchozí měsíc"
            className="rounded-lg border border-slate-300 bg-white p-1.5 text-slate-600 shadow-sm hover:bg-slate-50"
          >
            <ChevronLeft size={16} />
          </Link>
          <Link
            href={todayHref}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50"
          >
            Dnes
          </Link>
          <Link
            href={nextHref}
            aria-label="Další měsíc"
            className="rounded-lg border border-slate-300 bg-white p-1.5 text-slate-600 shadow-sm hover:bg-slate-50"
          >
            <ChevronRight size={16} />
          </Link>
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-xl border border-slate-200 md:block">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-medium text-slate-500">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        {grid.map((week) => (
          <div key={week[0]} className="grid grid-cols-7 border-b border-slate-100 last:border-b-0">
            {week.map((d) => {
              const list = byDay.get(d) ?? [];
              const inMonth = d.startsWith(monthPrefix);
              return (
                <div
                  key={d}
                  className={`flex min-h-24 flex-col gap-1 border-r border-slate-100 p-1.5 last:border-r-0 ${inMonth ? 'bg-white' : 'bg-slate-50/60'}`}
                >
                  <span
                    className={`self-end rounded-full px-1.5 text-xs ${d === today ? 'bg-brand-600 font-semibold text-white' : inMonth ? 'text-slate-700' : 'text-slate-400'}`}
                  >
                    {Number(d.slice(8, 10))}
                  </span>
                  {list.slice(0, 3).map((item) => chip(item, true))}
                  {list.length > 3 && (
                    <span className="text-[11px] text-slate-500">+{list.length - 3} další</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {agenda.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
            V tomto měsíci nejsou žádné termíny.
          </p>
        ) : (
          agenda.map(([d, list]) => (
            <div key={d} className="flex flex-col gap-1.5">
              <h3
                className={`text-xs font-semibold uppercase tracking-wide ${d === today ? 'text-brand-700' : 'text-slate-500'}`}
              >
                {fmtDay(d)}
                {d === today && ' · dnes'}
              </h3>
              <ul className="flex flex-col divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
                {list.map((item) => (
                  <li key={item.id} className="flex items-start gap-3 px-3 py-2">
                    <span
                      className={`mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${SOURCE_STYLES[item.source]}`}
                    >
                      {CALENDAR_SOURCE_LABELS[item.source]}
                    </span>
                    <div className="min-w-0 flex-1">
                      {linkItems && item.href ? (
                        <Link
                          href={item.href}
                          className="text-sm font-medium text-slate-800 hover:underline"
                        >
                          {item.title}
                        </Link>
                      ) : (
                        <p className="text-sm font-medium text-slate-800">{item.title}</p>
                      )}
                      <p className="text-xs text-slate-500">
                        {fmtItemTime(item)}
                        {item.location ? ` · ${item.location}` : ''}
                      </p>
                      {item.description && (
                        <p className="mt-0.5 whitespace-pre-line text-xs text-slate-600">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
