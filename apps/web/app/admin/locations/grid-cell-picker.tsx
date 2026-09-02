'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

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

/**
 * Výběrová matice polic regálu/skříně. Načte mřížku daného místa a nechá kliknout
 * konkrétní buňku (sekci). Používá se jako podvýběr v placement selektorech.
 */
export function GridCellPicker({
  locationId,
  selectedId,
  onPick,
}: {
  locationId: string;
  selectedId?: string;
  onPick: (cellId: string, label: string) => void;
}) {
  const [grid, setGrid] = useState<GridView | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setGrid(null);
    fetch(`/api/locations/${locationId}/grid`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((g: GridView | null) => active && setGrid(g))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [locationId]);

  if (loading) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-slate-400">
        <Loader2 size={13} className="animate-spin" /> Načítám police…
      </p>
    );
  }
  if (!grid || grid.rows === 0) {
    return <p className="text-xs text-slate-400">Toto místo nemá nastavenou mřížku polic.</p>;
  }

  const cellAt = (r: number, c: number) => grid.cells.find((x) => x.row === r && x.col === c);

  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${grid.cols}, minmax(44px, 1fr))` }}
    >
      {Array.from({ length: grid.rows }).flatMap((_, ri) =>
        Array.from({ length: grid.cols }).map((__, ci) => {
          const cell = cellAt(ri + 1, ci + 1);
          if (!cell) return <span key={`${ri}-${ci}`} />;
          const isSel = selectedId === cell.id;
          const occupied = cell.assetCount > 0;
          return (
            <button
              key={cell.id}
              type="button"
              onClick={() => onPick(cell.id, cell.label)}
              className={`flex h-12 flex-col items-center justify-center rounded-lg border text-xs transition ${
                isSel
                  ? 'border-brand-500 bg-brand-100 text-brand-800 ring-2 ring-brand-500/30'
                  : occupied
                    ? 'border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-brand-300'
              }`}
            >
              <span className="font-semibold">{cell.label}</span>
              {occupied && (
                <span className="mt-0.5 rounded-full bg-brand-600 px-1.5 text-[10px] font-bold text-white">
                  {cell.assetCount}
                </span>
              )}
            </button>
          );
        }),
      )}
    </div>
  );
}
