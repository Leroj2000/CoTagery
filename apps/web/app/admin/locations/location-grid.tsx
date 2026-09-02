'use client';

import { useCallback, useEffect, useState } from 'react';
import { Grid3x3, Loader2, Plus, X } from 'lucide-react';

interface Cell {
  id: string;
  row: number;
  col: number;
  label: string;
  assetCount: number;
}
interface GridView {
  rows: number;
  cols: number;
  cells: Cell[];
}
interface CellAsset {
  id: string;
  name: string;
  status: string;
}
interface AssetOpt {
  id: string;
  name: string;
}

const inputCls =
  'w-20 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10';

/**
 * Editor + vizualizace mřížky regálu/skříně. Buňky jsou child místa; klik na
 * buňku ukáže její obsah a umožní do ní umístit položku (home_location).
 */
export function LocationGrid({
  locationId,
  hasGrid,
  canManage,
  assets,
}: {
  locationId: string;
  hasGrid: boolean;
  canManage: boolean;
  assets: AssetOpt[];
}) {
  const [open, setOpen] = useState(false);
  const [grid, setGrid] = useState<GridView | null>(null);
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Cell | null>(null);
  const [contents, setContents] = useState<CellAsset[]>([]);
  const [placeId, setPlaceId] = useState('');

  const loadGrid = useCallback(async () => {
    const res = await fetch(`/api/locations/${locationId}/grid`, { cache: 'no-store' });
    if (res.ok) {
      const g = (await res.json()) as GridView;
      setGrid(g);
      if (g.rows > 0) setRows(g.rows);
      if (g.cols > 0) setCols(g.cols);
    }
  }, [locationId]);

  useEffect(() => {
    if (open && grid === null) void loadGrid();
  }, [open, grid, loadGrid]);

  async function generate() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/locations/${locationId}/grid`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rows, cols }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      setError(body.message ?? 'Generování se nezdařilo.');
      return;
    }
    setSelected(null);
    setGrid((await res.json()) as GridView);
  }

  async function selectCell(cell: Cell) {
    setSelected(cell);
    setPlaceId('');
    const res = await fetch(`/api/locations/${cell.id}/contents`, { cache: 'no-store' });
    setContents(res.ok ? ((await res.json()) as CellAsset[]) : []);
  }

  async function place() {
    if (!selected || !placeId) return;
    setBusy(true);
    const res = await fetch(`/api/locations/${selected.id}/contents`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ assetId: placeId }),
    });
    setBusy(false);
    if (res.ok) {
      await selectCell(selected);
      await loadGrid();
    }
  }

  const cellAt = (r: number, c: number) =>
    grid?.cells.find((x) => x.row === r && x.col === c);

  return (
    <div className="ml-6 mt-1">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
      >
        <Grid3x3 size={13} /> Mřížka {hasGrid ? '' : '(nastavit)'}
      </button>

      {open && (
        <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          {canManage && (
            <div className="mb-3 flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-xs text-slate-500">
                Řady (police)
                <input
                  type="number"
                  min={1}
                  max={26}
                  value={rows}
                  onChange={(e) => setRows(Math.max(1, Math.min(26, Number(e.target.value))))}
                  className={inputCls}
                />
              </label>
              <span className="pb-2 text-slate-400">×</span>
              <label className="flex flex-col gap-1 text-xs text-slate-500">
                Sloupce
                <input
                  type="number"
                  min={1}
                  max={26}
                  value={cols}
                  onChange={(e) => setCols(Math.max(1, Math.min(26, Number(e.target.value))))}
                  className={inputCls}
                />
              </label>
              <button
                onClick={generate}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
              >
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Grid3x3 size={13} />}
                {grid && grid.rows > 0 ? 'Přegenerovat' : 'Vygenerovat'}
              </button>
            </div>
          )}
          {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

          {grid && grid.rows > 0 ? (
            <div className="flex flex-wrap gap-4">
              <div
                className="grid gap-1.5"
                style={{ gridTemplateColumns: `repeat(${grid.cols}, minmax(48px, 1fr))` }}
              >
                {Array.from({ length: grid.rows }).flatMap((_, ri) =>
                  Array.from({ length: grid.cols }).map((__, ci) => {
                    const cell = cellAt(ri + 1, ci + 1);
                    const isSel = selected?.id === cell?.id;
                    const occupied = (cell?.assetCount ?? 0) > 0;
                    return (
                      <button
                        key={`${ri}-${ci}`}
                        onClick={() => cell && selectCell(cell)}
                        className={`flex h-14 flex-col items-center justify-center rounded-lg border text-xs transition ${
                          isSel
                            ? 'border-brand-500 bg-brand-100 text-brand-800 ring-2 ring-brand-500/30'
                            : occupied
                              ? 'border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100'
                              : 'border-slate-200 bg-white text-slate-500 hover:border-brand-300'
                        }`}
                      >
                        <span className="font-semibold">{cell?.label}</span>
                        {occupied && (
                          <span className="mt-0.5 rounded-full bg-brand-600 px-1.5 text-[10px] font-bold text-white">
                            {cell?.assetCount}
                          </span>
                        )}
                      </button>
                    );
                  }),
                )}
              </div>

              {selected && (
                <div className="min-w-56 flex-1 rounded-lg border border-slate-200 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-800">Sekce {selected.label}</p>
                    <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600">
                      <X size={15} />
                    </button>
                  </div>
                  {contents.length === 0 ? (
                    <p className="text-xs text-slate-400">Sekce je prázdná.</p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {contents.map((a) => (
                        <li key={a.id} className="truncate text-sm text-slate-700">
                          • {a.name}
                        </li>
                      ))}
                    </ul>
                  )}
                  {canManage && (
                    <div className="mt-3 flex gap-2">
                      <select
                        value={placeId}
                        onChange={(e) => setPlaceId(e.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none"
                      >
                        <option value="">— umístit položku sem —</option>
                        {assets.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={place}
                        disabled={!placeId || busy}
                        className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
                      >
                        <Plus size={13} /> Umístit
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400">
              {canManage ? 'Zadej řady × sloupce a vygeneruj mřížku.' : 'Mřížka není nastavena.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
