import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import {
  CALENDAR_SOURCE_LABELS,
  isCalendarSource,
  type CalendarEventDto,
  type CalendarItem,
  type CalendarShareDto,
  type CalendarSource,
} from '@tagery/shared';
import { apiFetch, getMyPermissions } from '../../lib/server-api';
import {
  SOURCE_STYLES,
  fmtDateTime,
  fmtDay,
  fmtItemTime,
  itemDays,
  gridRange,
  monthGrid,
  monthParam,
  parseMonth,
} from '../../lib/calendar';
import { CalendarMonth } from '../../ui/calendar-month';
import { NoAccess } from '../no-access';
import { PageHeader, Section, Table, Badge, EmptyState } from '../ui';
import { ActionForm } from '../action-form';
import { ActionButton } from '../action-button';
import { createCalendarEvent, deleteCalendarEvent, revokeCalendarShare } from './actions';
import { ShareForm } from './share-form';
import { TireSlotsSection } from './tire-slots-section';
import type { TireSlotView } from '@tagery/shared';

export const dynamic = 'force-dynamic';

function eventWhen(e: CalendarEventDto): string {
  const item: CalendarItem = {
    id: e.id,
    source: 'event',
    title: e.title,
    start: e.startsAt,
    end: e.endsAt,
    allDay: e.allDay,
  };
  if (e.allDay) {
    const days = itemDays(item);
    const first = fmtDay(days[0]);
    return days.length > 1 ? `${first} – ${fmtDay(days[days.length - 1])}` : `${first}, celý den`;
  }
  return e.endsAt ? `${fmtDateTime(e.startsAt)} (${fmtItemTime(item)})` : fmtDateTime(e.startsAt);
}

function shareState(s: CalendarShareDto): { label: string; tone: 'green' | 'red' | 'slate' } {
  if (s.revokedAt) return { label: 'zneplatněno', tone: 'red' };
  if (s.expiresAt && new Date(s.expiresAt) <= new Date())
    return { label: 'vypršelo', tone: 'slate' };
  return { label: 'aktivní', tone: 'green' };
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; src?: string; tab?: string }>;
}) {
  const perms = await getMyPermissions();
  if (!perms.has('core.calendar.view')) return <NoAccess what="Kalendář" />;
  const sp = await searchParams;
  const { year, month } = parseMonth(sp.m);
  const grid = monthGrid(year, month);
  const range = gridRange(grid);
  const selected = (sp.src ?? '').split(',').filter(isCalendarSource);

  const query = new URLSearchParams({ from: range.from, to: range.to });
  if (selected.length) query.set('sources', selected.join(','));
  const canManage = perms.has('core.calendar.manage');
  const canTires = perms.has('asset.tireslot.manage');
  const tab = canTires && sp.tab === 'tires' ? 'tires' : 'event';
  const tireSlots =
    tab === 'tires'
      ? await apiFetch<TireSlotView[]>(
          `/tire-slots?${new URLSearchParams({
            from: new Date(Date.now() - 86_400_000).toISOString(),
            to: new Date(Date.now() + 120 * 86_400_000).toISOString(),
          })}`,
        ).catch(() => null)
      : null;
  const [calendar, events, shares] = await Promise.all([
    apiFetch<{ sources: CalendarSource[]; items: CalendarItem[] }>(`/calendar?${query}`),
    apiFetch<CalendarEventDto[]>(
      `/calendar/events?${new URLSearchParams({ from: range.from, to: range.to })}`,
    ),
    canManage
      ? apiFetch<CalendarShareDto[]>('/calendar/shares').catch(() => [] as CalendarShareDto[])
      : Promise.resolve([] as CalendarShareDto[]),
  ]);

  const href = (m: string, src: CalendarSource[] = selected) => {
    const p = new URLSearchParams({ m });
    if (src.length) p.set('src', src.join(','));
    if (tab === 'tires') p.set('tab', 'tires');
    return `/admin/calendar?${p}`;
  };
  const current = monthParam(year, month);
  const now = parseMonth(undefined);
  const toggle = (s: CalendarSource) => {
    const base = selected.length ? selected : calendar.sources;
    const next = base.includes(s) ? base.filter((x) => x !== s) : [...base, s];
    return href(current, next.length === calendar.sources.length ? [] : next);
  };
  const active = (s: CalendarSource) => selected.length === 0 || selected.includes(s);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Kalendář"
        description="Všechny termíny firmy na jednom místě – události, rezervace, vrácení, servis, záruky a inventury."
        icon={<CalendarDays size={18} />}
      />

      <Section title="Přehled">
        <div className="mb-4 flex flex-wrap gap-2">
          {calendar.sources.map((s) => (
            <Link
              key={s}
              href={toggle(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition ${active(s) ? SOURCE_STYLES[s] : 'bg-white text-slate-400 ring-slate-200 line-through'}`}
            >
              {CALENDAR_SOURCE_LABELS[s]}
            </Link>
          ))}
        </div>
        <CalendarMonth
          year={year}
          month={month}
          items={calendar.items}
          prevHref={href(monthParam(year, month - 1))}
          nextHref={href(monthParam(year, month + 1))}
          todayHref={href(monthParam(now.year, now.month))}
          linkItems
        />
      </Section>

      {canTires && (
        <div className="flex gap-1 border-b border-slate-200 text-sm">
          {[
            { key: 'event', label: 'Nová událost' },
            { key: 'tires', label: 'Termíny přezutí' },
          ].map((t) => (
            <Link
              key={t.key}
              href={`/admin/calendar?m=${current}${t.key === 'tires' ? '&tab=tires' : ''}`}
              className={`-mb-px border-b-2 px-3 py-2 font-medium ${tab === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            >
              {t.label}
            </Link>
          ))}
        </div>
      )}

      {tab === 'tires' &&
        (tireSlots ? (
          <TireSlotsSection slots={tireSlots} />
        ) : (
          <EmptyState>Termíny přezutí nejsou dostupné (modul Vozidla není zapnutý).</EmptyState>
        ))}

      {tab === 'event' && perms.has('core.calendar.create') && (
        <Section
          title="Nová událost"
          description="Čas je v časovém pásmu firmy (Praha). U celodenní události se bere jen datum."
        >
          <ActionForm
            action={createCalendarEvent}
            submitLabel="Přidat událost"
            fields={[
              { name: 'title', label: 'Název', required: true, placeholder: 'např. Porada skladu' },
              { name: 'location', label: 'Místo', placeholder: 'např. Hala 2' },
              { name: 'startsAt', label: 'Začátek', type: 'datetime-local', required: true },
              { name: 'endsAt', label: 'Konec', type: 'datetime-local' },
              {
                name: 'allDay',
                label: 'Celý den',
                defaultValue: 'no',
                options: [
                  { value: 'no', label: 'Ne' },
                  { value: 'yes', label: 'Ano' },
                ],
              },
              { name: 'description', label: 'Popis' },
            ]}
          />
        </Section>
      )}

      <Section title={`Události v zobrazeném období (${events.length})`}>
        {events.length === 0 ? (
          <EmptyState>V tomto období nejsou žádné ručně založené události.</EmptyState>
        ) : (
          <Table
            head={['Kdy', 'Název', 'Místo', 'Akce']}
            rows={events.map((e) => [
              eventWhen(e),
              e.title,
              e.location ?? '—',
              perms.has('core.calendar.delete') ? (
                <ActionButton
                  key="d"
                  action={deleteCalendarEvent}
                  hidden={{ id: e.id }}
                  label="Smazat"
                  variant="danger"
                  confirm={`Smazat událost „${e.title}“?`}
                />
              ) : (
                '—'
              ),
            ])}
          />
        )}
      </Section>

      {canManage && (
        <Section
          title="Sdílení odkazem"
          description="Kdokoli s odkazem uvidí kalendář jen pro čtení, bez přihlášení. Odkaz jde kdykoli zneplatnit."
        >
          <div className="flex flex-col gap-6">
            <ShareForm sources={calendar.sources} />
            {shares.length === 0 ? (
              <EmptyState>Zatím žádné sdílené odkazy.</EmptyState>
            ) : (
              <Table
                head={['Název', 'Obsah', 'Platnost do', 'Naposledy otevřeno', 'Stav', 'Akce']}
                rows={shares.map((s) => {
                  const st = shareState(s);
                  return [
                    s.label ?? '—',
                    s.sources.map((x) => CALENDAR_SOURCE_LABELS[x]).join(', '),
                    s.expiresAt ? fmtDateTime(s.expiresAt) : 'bez omezení',
                    s.lastAccessedAt ? fmtDateTime(s.lastAccessedAt) : '—',
                    <Badge key="s" tone={st.tone}>
                      {st.label}
                    </Badge>,
                    st.label === 'aktivní' ? (
                      <ActionButton
                        key="r"
                        action={revokeCalendarShare}
                        hidden={{ id: s.id }}
                        label="Zneplatnit"
                        variant="danger"
                        confirm="Zneplatnit odkaz? Kdo ho má, kalendář už neuvidí."
                      />
                    ) : (
                      '—'
                    ),
                  ];
                })}
              />
            )}
          </div>
        </Section>
      )}
    </div>
  );
}
