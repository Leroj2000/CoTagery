import Link from 'next/link';
import { TIRE_SLOT_SEASON_LABELS, type TireSlotView } from '@tagery/shared';
import { Badge, EmptyState, Section, Table } from '../ui';
import { ActionForm } from '../action-form';
import { ActionButton } from '../action-button';
import {
  cancelTireBooking,
  cancelTireSlot,
  completeTireBooking,
  createTireSlots,
} from '../tire-slot-actions';
import { CUTOFF_NOTE, fmtSlot } from '../../lib/tire-slots';

/** Správa termínů přezutí (záložka kalendáře, jen asset.tireslot.manage). */
export function TireSlotsSection({ slots }: { slots: TireSlotView[] }) {
  const upcoming = slots.filter((s) => new Date(s.endsAt) > new Date());
  const booked = upcoming.reduce((n, s) => n + s.booked, 0);
  const capacity = upcoming.reduce((n, s) => n + s.capacity, 0);
  return (
    <>
      <Section
        title="Vypsat termíny přezutí"
        description="Den a rozmezí se rozdělí na termíny zvolené délky. Čas je v pásmu firmy (Praha)."
      >
        <ActionForm
          action={createTireSlots}
          submitLabel="Vypsat termíny"
          fields={[
            { name: 'day', label: 'Den', type: 'date', required: true },
            {
              name: 'from',
              label: 'Od',
              required: true,
              defaultValue: '8:00',
              placeholder: '8:00',
            },
            {
              name: 'to',
              label: 'Do',
              required: true,
              defaultValue: '16:00',
              placeholder: '16:00',
            },
            {
              name: 'durationMin',
              label: 'Délka termínu (min)',
              type: 'number',
              min: 5,
              defaultValue: '30',
              required: true,
            },
            {
              name: 'capacity',
              label: 'Vozidel na termín',
              type: 'number',
              min: 1,
              defaultValue: '1',
              required: true,
            },
            { name: 'location', label: 'Místo', placeholder: 'např. Pneuservis Novák, Brno' },
            {
              name: 'season',
              label: 'Přezutí',
              defaultValue: '',
              options: [
                { value: '', label: 'Neurčeno' },
                { value: 'winter', label: 'Na zimní' },
                { value: 'summer', label: 'Na letní' },
              ],
            },
            { name: 'note', label: 'Poznámka' },
          ]}
        />
        <p className="mt-2 text-xs text-slate-500">
          {CUTOFF_NOTE} Hotovo namontuje sadu sezóny termínu (je-li v evidenci) a zapíše servis.
        </p>
      </Section>

      <Section
        title={`Nadcházející termíny (${upcoming.length})`}
        description={`Obsazeno ${booked} z ${capacity} míst.`}
      >
        {upcoming.length === 0 ? (
          <EmptyState>Zatím žádné vypsané termíny přezutí.</EmptyState>
        ) : (
          <Table
            head={['Kdy', 'Místo', 'Přezutí', 'Obsazenost', 'Vozidla', 'Akce']}
            rows={upcoming.map((s) => [
              fmtSlot(s.startsAt, s.endsAt),
              s.location ?? '—',
              s.season ? TIRE_SLOT_SEASON_LABELS[s.season] : '—',
              <Badge key="o" tone={s.booked >= s.capacity ? 'amber' : 'green'}>
                {s.booked}/{s.capacity}
              </Badge>,
              s.bookings.length ? (
                <ul key="v" className="flex flex-col gap-2">
                  {s.bookings.map((b) => (
                    <li key={b.id} className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/assets/${b.assetId}`}
                        className="font-mono font-medium text-brand-700 hover:underline"
                      >
                        {b.plate ?? b.assetName}
                      </Link>
                      <span className="text-xs text-slate-500">{b.personName ?? '—'}</span>
                      {b.status === 'done' ? (
                        <Badge tone="slate">hotovo</Badge>
                      ) : (
                        <>
                          <ActionButton
                            action={completeTireBooking}
                            hidden={{ id: b.id, assetId: b.assetId }}
                            label="Hotovo"
                            confirm="Označit přezutí jako hotové? Namontuje se sada sezóny termínu a zapíše servis."
                          />
                          <ActionButton
                            action={cancelTireBooking}
                            hidden={{ id: b.id, assetId: b.assetId }}
                            label="Zrušit"
                            variant="danger"
                            confirm={`Zrušit rezervaci ${b.plate ?? b.assetName}?`}
                          />
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <span key="v" className="text-xs text-slate-400">
                  volno
                </span>
              ),
              <ActionButton
                key="c"
                action={cancelTireSlot}
                hidden={{ id: s.id }}
                label="Zrušit termín"
                variant="danger"
                confirm={
                  s.booked
                    ? 'Zrušit termín? Rezervace na něm se zruší (bez upozornění e-mailem).'
                    : 'Zrušit termín?'
                }
              />,
            ])}
          />
        )}
      </Section>
    </>
  );
}
