'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Search,
  SlidersHorizontal,
  X,
  ChevronDown,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { Asset } from '../../lib/types';

/** Stav položky → český label + barva badge (vzor MyStock). */
const STATUS: Record<string, { label: string; cls: string }> = {
  available: { label: 'Skladem', cls: 'bg-emerald-50 text-emerald-700' },
  assigned: { label: 'Přiděleno', cls: 'bg-sky-50 text-sky-700' },
  loaned: { label: 'Vypůjčeno', cls: 'bg-amber-50 text-amber-700' },
  reserved: { label: 'Rezervováno', cls: 'bg-amber-50 text-amber-700' },
  in_transfer: { label: 'Na cestě', cls: 'bg-slate-100 text-slate-600' },
  service: { label: 'Servis', cls: 'bg-violet-50 text-violet-700' },
  damaged: { label: 'Poškozeno', cls: 'bg-red-50 text-red-600' },
  lost: { label: 'Ztraceno', cls: 'bg-red-50 text-red-600' },
  retired: { label: 'Vyřazeno', cls: 'bg-slate-100 text-slate-500' },
};

function statusLabel(s: string): string {
  return STATUS[s]?.label ?? s;
}

const selectCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10';

/** Multi-select kategorií s počtem („N vybrané" + checkboxy). */
function CategoryMultiSelect({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: Set<string>;
  onToggle: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const label =
    selected.size === 0
      ? 'Všechny kategorie'
      : selected.size === 1
        ? [...selected][0]
        : `${selected.size} vybrané`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${selectCls} flex items-center justify-between gap-2 text-left`}
      >
        <span className="truncate">{label}</span>
        <ChevronDown size={15} className="shrink-0 text-slate-400" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          {options.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-400">Žádné kategorie</div>
          ) : (
            options.map((opt) => {
              const on = selected.has(opt);
              return (
                <button
                  type="button"
                  key={opt}
                  onClick={() => onToggle(opt)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300'
                    }`}
                  >
                    {on && <Check size={12} />}
                  </span>
                  <span className="truncate">{opt}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Přehled položek dle vzoru „MyStock": vždy viditelné primární filtry
 * (Kategorie multi-select, Stav, Sklad) + hledání, aktivní filtry jako chipy,
 * „Vymazat vše", počet a bohatší tabulka. Filtruje se klientsky nad načtenými daty.
 */
export function AssetsExplorer({
  assets,
  categoryNames,
  locations,
  actions,
}: {
  assets: Asset[];
  categoryNames: string[];
  locations: { id: string; name: string; isCell?: boolean }[];
  actions?: ReactNode;
}) {
  const [q, setQ] = useState('');
  const [cats, setCats] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState('');
  const [locationId, setLocationId] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState('name-asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const locName = useMemo(() => new Map(locations.map((l) => [l.id, l.name])), [locations]);

  // Stav filtr: jen stavy přítomné v datech (s českým labelem).
  const statusOptions = useMemo(() => {
    const present = [...new Set(assets.map((a) => a.status))];
    return present.sort((a, b) => statusLabel(a).localeCompare(statusLabel(b), 'cs'));
  }, [assets]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return assets.filter((a) => {
      if (cats.size > 0 && !(a.category && cats.has(a.category))) return false;
      if (status && a.status !== status) return false;
      if (locationId && a.homeLocationId !== locationId) return false;
      if (needle) {
        const hay =
          `${a.name} ${a.inventoryNumber ?? ''} ${a.manufacturer ?? ''} ${a.serialNumber ?? ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [assets, cats, status, locationId, q]);

  const sorted = useMemo(() => {
    const [field, direction] = sort.split('-') as [
      'name' | 'inventory' | 'status' | 'created',
      'asc' | 'desc',
    ];
    const sign = direction === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const left =
        field === 'inventory'
          ? (a.inventoryNumber ?? '')
          : field === 'status'
            ? statusLabel(a.status)
            : field === 'created'
              ? a.createdAt
              : a.name;
      const right =
        field === 'inventory'
          ? (b.inventoryNumber ?? '')
          : field === 'status'
            ? statusLabel(b.status)
            : field === 'created'
              ? b.createdAt
              : b.name;
      return left.localeCompare(right, 'cs', { numeric: true, sensitivity: 'base' }) * sign;
    });
  }, [filtered, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = useMemo(
    () => sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [sorted, currentPage, pageSize],
  );

  useEffect(() => setPage(1), [q, cats, status, locationId, sort, pageSize]);

  const hasFilters = cats.size > 0 || status !== '' || locationId !== '' || q !== '';

  function toggleCat(name: string): void {
    setCats((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function clearAll(): void {
    setCats(new Set());
    setStatus('');
    setLocationId('');
    setQ('');
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
      {actions && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <h3 className="text-sm font-semibold text-slate-700">Položky</h3>
          {actions}
        </div>
      )}
      {/* Řádek: hledání + přepínač filtrů na mobilu */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Hledat položku…"
            className={`${selectCls} pl-9`}
          />
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 sm:hidden"
        >
          <SlidersHorizontal size={15} /> Filtry
        </button>
      </div>

      {/* Primární filtry – vždy viditelné na sm+, na mobilu přes „Filtry" */}
      <div className={`mt-3 grid gap-3 sm:grid-cols-3 ${filtersOpen ? 'grid' : 'hidden sm:grid'}`}>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Kategorie</span>
          <CategoryMultiSelect options={categoryNames} selected={cats} onToggle={toggleCat} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Stav</span>
          <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Všechny stavy</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Sklad</span>
          <select
            className={selectCls}
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
          >
            <option value="">Všechny sklady</option>
            {locations
              .filter((l) => !l.isCell)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
          </select>
        </label>
      </div>

      {/* Aktivní filtry (chipy) + Vymazat vše */}
      {hasFilters && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Aktivní filtry:</span>
          {[...cats].map((c) => (
            <Chip key={`c-${c}`} label={`Kategorie: ${c}`} onClear={() => toggleCat(c)} />
          ))}
          {status && <Chip label={`Stav: ${statusLabel(status)}`} onClear={() => setStatus('')} />}
          {locationId && (
            <Chip
              label={`Sklad: ${locName.get(locationId) ?? '—'}`}
              onClear={() => setLocationId('')}
            />
          )}
          {q && <Chip label={`Hledání: „${q}"`} onClear={() => setQ('')} />}
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
          >
            <X size={13} /> Vymazat vše
          </button>
        </div>
      )}

      {/* Počet */}
      <p className="mt-4 text-xs text-slate-400">
        Zobrazeno {filtered.length} {plural(filtered.length)}
        {filtered.length !== assets.length && ` z ${assets.length}`}
      </p>

      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <label className="flex min-w-48 flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Řazení</span>
          <select className={selectCls} value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="name-asc">Název A–Z</option>
            <option value="name-desc">Název Z–A</option>
            <option value="inventory-asc">Inventární číslo</option>
            <option value="status-asc">Stav</option>
            <option value="created-desc">Nejnovější</option>
            <option value="created-asc">Nejstarší</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Na stránku</span>
          <select
            className={selectCls}
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
      </div>

      {/* Tabulka */}
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="w-10 py-2"></th>
              <th className="py-2 pr-3 font-medium">Název</th>
              <th className="py-2 pr-3 font-medium">Kategorie</th>
              <th className="py-2 pr-3 font-medium">Kód</th>
              <th className="py-2 pr-3 font-medium">Stav</th>
              <th className="py-2 pr-3 font-medium">Sklad</th>
              <th className="py-2 font-medium">Výrobce</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-sm text-slate-400">
                  Žádná položka neodpovídá filtru.
                </td>
              </tr>
            ) : (
              visible.map((a) => {
                const st = STATUS[a.status] ?? {
                  label: a.status,
                  cls: 'bg-slate-100 text-slate-600',
                };
                return (
                  <tr
                    key={a.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                  >
                    <td className="py-2.5">
                      {a.photoKey ? (
                        <Image
                          src={`/api/asset-photo/${a.id}`}
                          alt={a.name}
                          width={36}
                          height={36}
                          unoptimized
                          className="h-9 w-9 rounded-lg border border-slate-200 object-cover"
                        />
                      ) : (
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-[10px] text-slate-400">
                          —
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <Link
                        href={`/admin/assets/${a.id}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {a.name}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3">
                      {a.category ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          {a.category}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 font-mono text-xs text-slate-500">
                      {a.inventoryNumber ?? '—'}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}
                      >
                        {st.label}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-slate-600">
                      {a.homeLocationId ? (locName.get(a.homeLocationId) ?? '—') : '—'}
                    </td>
                    <td className="py-2.5 text-slate-600">{a.manufacturer ?? '—'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {sorted.length > pageSize && (
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm text-slate-600">
          <span>
            Strana {currentPage} z {pageCount}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="rounded-lg border border-slate-300 p-2 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Předchozí strana"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              disabled={currentPage === pageCount}
              onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
              className="rounded-lg border border-slate-300 p-2 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Další strana"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
      {label}
      <button
        type="button"
        onClick={onClear}
        className="hover:text-brand-900"
        aria-label="Odebrat filtr"
      >
        <X size={12} />
      </button>
    </span>
  );
}

function plural(n: number): string {
  return n === 1 ? 'položka' : n >= 2 && n <= 4 ? 'položky' : 'položek';
}
