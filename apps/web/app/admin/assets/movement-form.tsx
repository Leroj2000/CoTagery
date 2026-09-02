'use client';

import { useActionState, useState } from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { performAssetMovement } from '../actions';
import type { ActionState } from '../action-form';
import { GridCellPicker } from '../locations/grid-cell-picker';

const ACTION_LABELS: Record<string, string> = {
  loan: 'Půjčit',
  assign: 'Přidělit',
  move: 'Přesunout',
  return: 'Vrátit',
  handover: 'Předat dál',
  service_out: 'Do servisu',
  service_return: 'Ze servisu',
  dispose: 'Vyřadit',
};

// Které akce cílí na osobu / lokaci / nemají cíl.
const TARGET_KIND: Record<string, 'person' | 'location' | 'both' | 'none'> = {
  loan: 'person',
  handover: 'person',
  assign: 'both',
  move: 'location',
  return: 'location',
  service_out: 'both',
  service_return: 'location',
  dispose: 'none',
};

interface Opt {
  id: string;
  label: string;
  /** Místo je regál/skříň s mřížkou → nabídne se podvýběr police. */
  grid?: boolean;
}

/** Kontextová akce nad assetem: vybere se typ pohybu → cíl → provede se. */
export function MovementForm({
  assetId,
  actions,
  people,
  locations,
}: {
  assetId: string;
  actions: string[];
  people: Opt[];
  locations: Opt[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    performAssetMovement,
    null,
  );
  const [type, setType] = useState(actions[0] ?? '');
  const [sel, setSel] = useState('');
  const [cellId, setCellId] = useState('');
  const [cellLabel, setCellLabel] = useState('');

  const kind = TARGET_KIND[type] ?? 'both';
  const targetOptions: { value: string; label: string }[] = [];
  if (kind === 'person' || kind === 'both')
    targetOptions.push(...people.map((p) => ({ value: `person:${p.id}`, label: `👤 ${p.label}` })));
  if (kind === 'location' || kind === 'both')
    targetOptions.push(...locations.map((l) => ({ value: `location:${l.id}`, label: `📍 ${l.label}` })));

  // Vybraný cíl je regál/skříň → nabídni matici polic; cíl se pak stane buňka.
  const selLoc = sel.startsWith('location:')
    ? locations.find((l) => l.id === sel.slice('location:'.length))
    : undefined;
  const isGrid = selLoc?.grid === true;
  const finalTarget = isGrid && cellId ? `location:${cellId}` : sel;

  const resetTarget = () => {
    setSel('');
    setCellId('');
    setCellLabel('');
  };

  if (actions.length === 0) {
    return <p className="text-sm text-slate-400">Pro tento stav nejsou dostupné žádné akce.</p>;
  }

  const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10';

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="assetId" value={assetId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-600">Akce</label>
          <select
            name="type"
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              resetTarget();
            }}
            className={inputCls}
          >
            {actions.map((a) => (
              <option key={a} value={a}>
                {ACTION_LABELS[a] ?? a}
              </option>
            ))}
          </select>
        </div>

        {kind !== 'none' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-600">
              Komu / kam {type === 'return' || type === 'service_return' ? '(volitelné)' : ''}
            </label>
            <input type="hidden" name="target" value={finalTarget} />
            <select
              value={sel}
              onChange={(e) => {
                setSel(e.target.value);
                setCellId('');
                setCellLabel('');
              }}
              className={inputCls}
            >
              <option value="">
                {type === 'return' || type === 'service_return' ? '— domů —' : '— vyber —'}
              </option>
              {targetOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {isGrid && selLoc && (
              <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
                <p className="mb-2 text-xs text-slate-500">
                  {cellId ? (
                    <span className="font-medium text-brand-700">
                      {selLoc.label} › {cellLabel}
                    </span>
                  ) : (
                    'Vyber polici (jinak se uloží celý regál/skříň)'
                  )}
                </p>
                <GridCellPicker
                  locationId={selLoc.id}
                  selectedId={cellId}
                  onPick={(id, lbl) => {
                    setCellId(id);
                    setCellLabel(lbl);
                  }}
                />
              </div>
            )}
          </div>
        )}

        {(type === 'loan' || type === 'assign') && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-600">Vrátit do (volitelné)</label>
            <input type="date" name="dueAt" className={inputCls} />
          </div>
        )}

        {(type === 'loan' || type === 'assign' || type === 'handover') && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-slate-600">Potvrzení převzetí</label>
            <select name="requireConfirmation" className={inputCls} defaultValue="false">
              <option value="false">Nevyžadovat</option>
              <option value="true">Vyžádat potvrzení příjemcem</option>
            </select>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-600">Poznámka</label>
          <input name="note" placeholder="volitelně" className={inputCls} />
        </div>
      </div>

      {state?.error && (
        <p className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle size={15} /> {state.error}
        </p>
      )}
      {state?.ok && (
        <p className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <CheckCircle2 size={15} /> {state.message}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
        >
          {pending && <Loader2 size={15} className="animate-spin" />}
          {pending ? 'Provádím…' : 'Provést akci'}
        </button>
      </div>
    </form>
  );
}
