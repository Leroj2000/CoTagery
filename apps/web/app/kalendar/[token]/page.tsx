import type { Metadata } from 'next';
import { CalendarDays, Download } from 'lucide-react';
import type { PublicCalendar } from '@tagery/shared';
import { apiBase } from '../../lib/session';
import { gridRange, monthGrid, monthParam, parseMonth } from '../../lib/calendar';
import { CalendarMonth } from '../../ui/calendar-month';
import { Logo } from '../../ui/logo';

export const dynamic = 'force-dynamic';

// Token je v URL – neindexovat a neposílat ho dál v Referer hlavičce.
export const metadata: Metadata = {
  title: 'Sdílený kalendář',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

async function loadCalendar(
  token: string,
  from: string,
  to: string,
): Promise<PublicCalendar | null> {
  const res = await fetch(
    `${apiBase()}/api/v1/public/calendar/${encodeURIComponent(token)}?${new URLSearchParams({ from, to })}`,
    { cache: 'no-store' },
  );
  if (!res.ok) return null;
  return (await res.json()) as PublicCalendar;
}

/** Veřejný kalendář jen pro čtení (sdílený odkaz, bez přihlášení). */
export default async function PublicCalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ m?: string }>;
}) {
  const { token } = await params;
  const { m } = await searchParams;
  const { year, month } = parseMonth(m);
  const grid = monthGrid(year, month);
  const range = gridRange(grid);
  const calendar = await loadCalendar(token, range.from, range.to);
  const base = `/kalendar/${encodeURIComponent(token)}`;
  const now = parseMonth(undefined);

  return (
    <main className="min-h-dvh bg-slate-50">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 p-4 sm:p-6">
        <header className="flex items-center justify-between pt-2">
          <Logo />
          <span className="text-xs text-slate-400">jen pro čtení</span>
        </header>

        {!calendar ? (
          <div className="mx-auto mt-10 flex max-w-md flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-card">
            <CalendarDays size={28} className="text-slate-400" />
            <h1 className="text-base font-semibold text-slate-800">Kalendář není dostupný</h1>
            <p className="text-sm text-slate-500">
              Odkaz neexistuje, vypršel, nebo ho správce zneplatnil. Požádej o nový.
            </p>
          </div>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <CalendarDays size={18} />
                </span>
                <h1 className="text-xl font-semibold tracking-tight text-slate-900">
                  {calendar.title}
                </h1>
              </div>
              <a
                href={`${base}/ics`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50"
              >
                <Download size={14} /> Přidat do kalendáře (iCal)
              </a>
            </div>
            <CalendarMonth
              year={year}
              month={month}
              items={calendar.items}
              prevHref={`${base}?m=${monthParam(year, month - 1)}`}
              nextHref={`${base}?m=${monthParam(year, month + 1)}`}
              todayHref={`${base}?m=${monthParam(now.year, now.month)}`}
            />
          </section>
        )}
      </div>
    </main>
  );
}
