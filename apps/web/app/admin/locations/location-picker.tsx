'use client';

import { useState } from 'react';
import { GridCellPicker } from './grid-cell-picker';

export interface LocationOpt {
  value: string;
  label: string;
  grid?: boolean;
}

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10';

/**
 * Výběr místa pro umístění položky. Buňky mřížky nejsou v seznamu; když se vybere
 * regál/skříň, vyskočí jeho matice polic jako podvýběr a klikem se zvolí buňka.
 * Do formuláře odešle `name` = id buňky (byla-li vybrána), jinak id místa.
 */
export function LocationPicker({
  name,
  locations,
  defaultValue = '',
  placeholder = '— žádné —',
}: {
  name: string;
  locations: LocationOpt[];
  defaultValue?: string;
  placeholder?: string;
}) {
  const preset = locations.some((l) => l.value === defaultValue);
  const [locId, setLocId] = useState(preset ? defaultValue : '');
  const [cellId, setCellId] = useState('');
  const [cellLabel, setCellLabel] = useState('');

  const selected = locations.find((l) => l.value === locId);
  const isGrid = selected?.grid === true;
  const finalId = isGrid ? cellId || locId : locId;

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={finalId} />
      <select
        value={locId}
        onChange={(e) => {
          setLocId(e.target.value);
          setCellId('');
          setCellLabel('');
        }}
        className={inputCls}
      >
        <option value="">{placeholder}</option>
        {locations.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label}
            {l.grid ? ' ▸ police' : ''}
          </option>
        ))}
      </select>

      {isGrid && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
          <p className="mb-2 text-xs text-slate-500">
            {cellId ? (
              <span className="font-medium text-brand-700">
                {selected?.label} › {cellLabel}
              </span>
            ) : (
              'Vyber polici (jinak se uloží celý regál/skříň)'
            )}
          </p>
          <GridCellPicker
            locationId={locId}
            selectedId={cellId}
            onPick={(id, label) => {
              setCellId(id);
              setCellLabel(label);
            }}
          />
        </div>
      )}
    </div>
  );
}
