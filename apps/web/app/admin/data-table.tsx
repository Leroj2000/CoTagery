'use client';

import { Children, isValidElement, useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

const PAGE_SIZES = [10, 25, 50, 100] as const;

function EmptyTable({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-400">
      {children}
    </div>
  );
}

function nodeText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join(' ');
  if (!isValidElement(node)) return '';
  const props = node.props as { children?: ReactNode };
  return Children.toArray(props.children).map(nodeText).join(' ');
}

export function DataTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  const [query, setQuery] = useState('');
  const [sortColumn, setSortColumn] = useState(0);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const prepared = useMemo(
    () =>
      rows.map((cells, originalIndex) => ({
        cells,
        originalIndex,
        texts: cells.map((cell) => nodeText(cell).trim()),
      })),
    [rows],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('cs');
    const result = needle
      ? prepared.filter((row) =>
          row.texts.some((text) => text.toLocaleLowerCase('cs').includes(needle)),
        )
      : prepared;
    return [...result].sort((left, right) => {
      const compared = (left.texts[sortColumn] ?? '').localeCompare(
        right.texts[sortColumn] ?? '',
        'cs',
        {
          numeric: true,
          sensitivity: 'base',
        },
      );
      return (
        (compared || left.originalIndex - right.originalIndex) * (sortDirection === 'asc' ? 1 : -1)
      );
    });
  }, [prepared, query, sortColumn, sortDirection]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const showControls = rows.length >= 5;

  function resetPage(): void {
    setPage(1);
  }

  if (rows.length === 0) return <EmptyTable>Zatím žádné záznamy.</EmptyTable>;

  return (
    <div className="space-y-3">
      {showControls && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="relative min-w-52 flex-1">
            <span className="sr-only">Hledat v tabulce</span>
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                resetPage();
              }}
              placeholder="Hledat v seznamu…"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm"
            />
          </label>
          <label>
            <span className="sr-only">Řadit podle</span>
            <select
              value={sortColumn}
              onChange={(event) => {
                setSortColumn(Number(event.target.value));
                resetPage();
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {head.map((label, index) => (
                <option key={`${label}-${index}`} value={index}>
                  Řadit: {label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setSortDirection((value) => (value === 'asc' ? 'desc' : 'asc'));
              resetPage();
            }}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            aria-label={sortDirection === 'asc' ? 'Řadit sestupně' : 'Řadit vzestupně'}
          >
            {sortDirection === 'asc' ? 'A–Z ↑' : 'Z–A ↓'}
          </button>
          <label>
            <span className="sr-only">Počet záznamů na stránku</span>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                resetPage();
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size} / strana
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyTable>Žádný záznam neodpovídá hledání.</EmptyTable>
      ) : (
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                {head.map((label, index) => (
                  <th key={`${label}-${index}`} className="px-3 py-2.5">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr
                  key={row.originalIndex}
                  className="border-b border-slate-100 transition-colors last:border-0 hover:bg-slate-50/70"
                >
                  {row.cells.map((cell, index) => (
                    <td key={index} className="px-3 py-2.5 align-middle text-slate-700">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showControls && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            Zobrazeno {visible.length} z {filtered.length} záznamů
          </span>
          {pageCount > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                className="rounded-lg border border-slate-300 p-1.5 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Předchozí stránka"
              >
                <ChevronLeft size={15} />
              </button>
              <span>
                {currentPage} / {pageCount}
              </span>
              <button
                type="button"
                disabled={currentPage === pageCount}
                onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
                className="rounded-lg border border-slate-300 p-1.5 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Další stránka"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
