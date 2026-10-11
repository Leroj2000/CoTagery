'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  X,
} from 'lucide-react';

type ImportAction = 'create' | 'update' | 'unchanged' | 'error';

interface ImportResult {
  dryRun: boolean;
  total: number;
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
  warnings: string[];
  rows: {
    row: number;
    action: ImportAction;
    name: string;
    inventoryNumber: string | null;
    changes: string[];
    error?: string;
  }[];
  truncated: boolean;
}

const btn =
  'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50';
const primary =
  'inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-40';

const ACTION: Record<ImportAction, { label: string; cls: string }> = {
  create: { label: 'Nová', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  update: { label: 'Úprava', cls: 'bg-brand-50 text-brand-700 ring-brand-200' },
  unchanged: { label: 'Beze změny', cls: 'bg-slate-100 text-slate-600 ring-slate-200' },
  error: { label: 'Chyba', cls: 'bg-red-50 text-red-700 ring-red-200' },
};

/** Export (Excel/CSV) a import s náhledem změn před uložením. */
export function AssetTransfer({ canImport }: { canImport: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <ExportMenu />
      {canImport && (
        <button type="button" className={btn} onClick={() => setOpen(true)}>
          <Upload size={15} /> Import
        </button>
      )}
      {open && <ImportDialog onClose={() => setOpen(false)} />}
    </div>
  );
}

function ExportMenu() {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) ref.current.open = false;
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  return (
    <details ref={ref} className="relative">
      <summary className={`${btn} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>
        <Download size={15} /> Export <ChevronDown size={14} className="text-slate-400" />
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
        <a
          href="/api/assets-export?format=xlsx"
          className="flex items-start gap-2 px-3 py-2 text-sm hover:bg-slate-50"
          onClick={() => ref.current && (ref.current.open = false)}
        >
          <FileSpreadsheet size={16} className="mt-0.5 text-emerald-600" />
          <span>
            <span className="block font-medium text-slate-800">Excel (.xlsx)</span>
            <span className="text-xs text-slate-500">Doporučeno – data, čísla i filtry</span>
          </span>
        </a>
        <a
          href="/api/assets-export?format=csv"
          className="flex items-start gap-2 px-3 py-2 text-sm hover:bg-slate-50"
          onClick={() => ref.current && (ref.current.open = false)}
        >
          <Download size={16} className="mt-0.5 text-slate-400" />
          <span>
            <span className="block font-medium text-slate-800">CSV</span>
            <span className="text-xs text-slate-500">Se středníkem pro český Excel</span>
          </span>
        </a>
      </div>
    </details>
  );
}

function ImportDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Zámek scrollu stránky po dobu otevření (jednou, ať se po zavření obnoví).
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && close();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  function close() {
    if (result && !result.dryRun) router.refresh();
    onClose();
  }

  async function send(f: File, dryRun: boolean) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', f, f.name);
      const res = await fetch(`/api/assets-import?dryRun=${dryRun ? '1' : '0'}`, {
        method: 'POST',
        body: fd,
      });
      const data = (await res.json().catch(() => null)) as
        (ImportResult & { message?: string | string[] }) | null;
      if (!res.ok || !data) {
        const msg = Array.isArray(data?.message) ? data?.message[0] : data?.message;
        throw new Error(msg || `Import selhal (${res.status})`);
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import selhal');
    } finally {
      setBusy(false);
    }
  }

  function pick(f: File | null) {
    setFile(f);
    setResult(null);
    if (f) void send(f, true);
  }

  const changes = result ? result.created + result.updated : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Import položek"
        className="flex max-h-[92dvh] w-full max-w-3xl flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-900">Import položek</h2>
          <button
            type="button"
            onClick={close}
            disabled={busy}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Zavřít"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!result || result.dryRun ? (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                <p>
                  Nahraj Excel (.xlsx) nebo CSV. Nejjednodušší je <strong>stáhnout export</strong>,
                  upravit ho a nahrát zpět – řádky s ID nebo existujícím inventárním číslem se{' '}
                  <strong>upraví</strong>, ostatní se
                  <strong> založí</strong>. Prázdná buňka znamená „beze změny".
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href="/api/assets-template?format=xlsx" className={btn}>
                    <FileSpreadsheet size={15} className="text-emerald-600" /> Šablona Excel
                  </a>
                  <a href="/api/assets-template?format=csv" className={btn}>
                    <Download size={15} /> Šablona CSV
                  </a>
                </div>
              </div>

              <label
                className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center text-sm transition ${
                  file ? 'border-brand-300 bg-brand-50/40' : 'border-slate-300 hover:bg-slate-50'
                }`}
              >
                {busy ? (
                  <Loader2 size={22} className="animate-spin text-brand-600" />
                ) : (
                  <Upload size={22} className="text-slate-400" />
                )}
                <span className="font-medium text-slate-800">
                  {file ? file.name : 'Vybrat soubor .xlsx nebo .csv'}
                </span>
                <span className="text-xs text-slate-500">
                  {busy ? 'Kontroluji soubor…' : 'Nejdřív uvidíš náhled – nic se hned neuloží.'}
                </span>
                <input
                  type="file"
                  accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    e.target.value = '';
                    pick(f);
                  }}
                />
              </label>

              {error && <ErrorBox text={error} />}
              {result && <Preview result={result} />}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-4 text-emerald-900">
                <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-600" />
                <div>
                  <p className="font-medium">Import dokončen</p>
                  <p className="text-sm">
                    Založeno {result.created}, upraveno {result.updated}
                    {result.failed > 0 && `, chybných řádků ${result.failed}`}.
                  </p>
                </div>
              </div>
              {result.failed > 0 && <Preview result={result} onlyErrors />}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
          {result && !result.dryRun ? (
            <button type="button" className={primary} onClick={close}>
              Hotovo
            </button>
          ) : (
            <>
              {result && result.failed > 0 && changes > 0 && (
                <span className="mr-auto text-xs text-slate-500">Chybné řádky se přeskočí.</span>
              )}
              <button type="button" className={btn} onClick={close} disabled={busy}>
                Zrušit
              </button>
              <button
                type="button"
                className={primary}
                disabled={!file || !result || changes === 0 || busy}
                onClick={() => file && send(file, false)}
              >
                {busy && result && <Loader2 size={15} className="animate-spin" />}
                {result && changes > 0
                  ? `Importovat (${[
                      result.created && `${result.created} nových`,
                      result.updated && `${result.updated} úprav`,
                    ]
                      .filter(Boolean)
                      .join(', ')})`
                  : 'Importovat'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ErrorBox({ text }: { text: string }) {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-100">
      <AlertCircle size={15} className="mt-0.5 shrink-0" /> {text}
    </p>
  );
}

function Preview({ result, onlyErrors }: { result: ImportResult; onlyErrors?: boolean }) {
  const rows = onlyErrors ? result.rows.filter((r) => r.action === 'error') : result.rows;
  return (
    <div className="flex flex-col gap-3">
      {!onlyErrors && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Nové" value={result.created} cls="text-emerald-700" />
          <Stat label="Úpravy" value={result.updated} cls="text-brand-700" />
          <Stat label="Beze změny" value={result.unchanged} cls="text-slate-600" />
          <Stat label="Chyby" value={result.failed} cls="text-red-600" />
        </div>
      )}
      {result.warnings.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-inset ring-amber-100">
          {result.warnings.map((w) => (
            <li key={w} className="flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {w}
            </li>
          ))}
        </ul>
      )}
      {rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <ul className="divide-y divide-slate-100">
            {rows.map((r) => (
              <li key={r.row} className="flex items-start gap-3 px-3 py-2 text-sm">
                <span className="w-10 shrink-0 pt-0.5 text-xs tabular-nums text-slate-400">
                  ř. {r.row}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${ACTION[r.action].cls}`}
                >
                  {ACTION[r.action].label}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-800">
                    {r.name || '—'}
                    {r.inventoryNumber && (
                      <span className="font-normal text-slate-400"> · {r.inventoryNumber}</span>
                    )}
                  </span>
                  {r.error ? (
                    <span className="block text-xs text-red-600">{r.error}</span>
                  ) : (
                    r.action === 'update' && (
                      <span className="block text-xs text-slate-500">
                        Mění: {r.changes.join(', ')}
                      </span>
                    )
                  )}
                </span>
              </li>
            ))}
          </ul>
          {result.truncated && (
            <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
              Zobrazeno prvních 500 řádků se změnou.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="rounded-xl border border-slate-200 px-3 py-2">
      <p className={`text-lg font-semibold tabular-nums ${cls}`}>{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
