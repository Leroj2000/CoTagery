import { CalendarClock } from 'lucide-react';
import type { AssetTireBookingView } from '@tagery/shared';
import { ActionButton } from './action-button';
import {
  bookTireSlot,
  cancelTireBooking,
  completeTireBooking,
  moveTireBooking,
} from './tire-slot-actions';
import { CUTOFF_NOTE, fmtSlot, fmtSlotShort, seasonLabel } from '../lib/tire-slots';

/**
 * Stav přezutí jednoho vozidla: rezervovaný termín (Změnit / Zrušit, správce i
 * Hotovo), nebo až 3 nejbližší volné termíny jako tlačítka „jedním klikem“.
 */
export function TireBookingBox({
  view,
  canComplete = false,
  showTitle = false,
}: {
  view: AssetTireBookingView;
  canComplete?: boolean;
  showTitle?: boolean;
}) {
  const b = view.booking;
  const assetId = view.assetId;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 text-sm">
      <div className="flex items-center gap-2 font-medium text-slate-800">
        <CalendarClock size={16} className="text-brand-700" />
        {showTitle ? (
          <span>
            Přezutí – {view.assetName}
            {view.plate && <span className="ml-1 font-mono text-slate-500">{view.plate}</span>}
          </span>
        ) : (
          <span>Termín přezutí</span>
        )}
      </div>
      {b ? (
        <>
          <p className="text-slate-700">
            <span className="font-semibold">{fmtSlot(b.startsAt, b.endsAt)}</span>
            {b.location && <span> · {b.location}</span>}
            {seasonLabel(b.season) && (
              <span className="text-slate-500"> · {seasonLabel(b.season)}</span>
            )}
          </p>
          {b.personName && <p className="text-xs text-slate-500">Pro: {b.personName}</p>}
          <div className="flex flex-wrap gap-2">
            {b.changeable && (
              <>
                {view.suggestions.length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-slate-600 hover:bg-slate-50">
                      Změnit
                    </summary>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {view.suggestions.map((s) => (
                        <ActionButton
                          key={s.id}
                          action={moveTireBooking}
                          hidden={{ id: b.id, slotId: s.id, assetId }}
                          label={fmtSlotShort(s.startsAt)}
                        />
                      ))}
                    </div>
                  </details>
                )}
                <ActionButton
                  action={cancelTireBooking}
                  hidden={{ id: b.id, assetId }}
                  label="Zrušit"
                  variant="danger"
                  confirm="Zrušit rezervaci přezutí?"
                />
              </>
            )}
            {canComplete && (
              <ActionButton
                action={completeTireBooking}
                hidden={{ id: b.id, assetId }}
                label="Hotovo"
                confirm={
                  b.season
                    ? 'Označit přezutí jako hotové? Namontuje se sada sezóny termínu a zapíše servis.'
                    : 'Označit přezutí jako hotové? Zapíše se servisní záznam.'
                }
              />
            )}
          </div>
          {!b.changeable && (
            <p className="text-xs text-amber-800">
              Termín je za méně než 24 h – změnu nebo zrušení domluv se správcem vozového parku.
            </p>
          )}
        </>
      ) : view.canBook ? (
        view.suggestions.length ? (
          <>
            <p className="text-xs text-slate-500">Vyber termín – rezervuje se jedním klikem.</p>
            <div className="flex flex-wrap gap-2">
              {view.suggestions.map((s) => (
                <ActionButton
                  key={s.id}
                  action={bookTireSlot}
                  hidden={{ slotId: s.id, assetId }}
                  label={`${fmtSlotShort(s.startsAt)}${s.location ? ` · ${s.location}` : ''}`}
                />
              ))}
            </div>
            <p className="text-xs text-slate-400">{CUTOFF_NOTE}</p>
          </>
        ) : (
          <p className="text-xs text-slate-500">
            Žádný volný termín přezutí. Termíny vypisuje správce; rezervovat jde nejpozději 24 h
            předem.
          </p>
        )
      ) : (
        <p className="text-xs text-slate-500">{view.reason}</p>
      )}
    </div>
  );
}
