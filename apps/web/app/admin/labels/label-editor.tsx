'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  Star,
  Trash2,
} from 'lucide-react';
import {
  LABEL_CELL_LABELS,
  LABEL_CUSTOM_TEXT_MAX,
  LABEL_FORMATS,
  LABEL_MAX_CELLS,
  LABEL_PRESET_KINDS,
  defaultLabelTemplate,
  findLabelFormat,
  normalizeLabelCells,
  type LabelCell,
  type LabelCellKind,
  type LabelCellSize,
} from '@tagery/shared';
import { LabelPreview } from '../assets/printing/label-preview';
import { templateFor, type LabelTemplatesView } from '../../lib/printing/label-templates';
import type { LabelData } from '../../lib/printing/types';

/** Ukázková položka pro náhled (logo firmy se doplní automaticky). */
const SAMPLE: LabelData = {
  qrValue: 'https://app.tagery.tech/r/AB12CD34',
  itemName: 'Akumulátorová vrtačka Makita DDF485',
  assetCode: 'INV-2024-0042',
  category: 'Nářadí',
  location: 'Sklad A / Regál 3',
};

const SIZE_LABELS: Record<LabelCellSize, string> = { S: 'Malé', M: 'Střední', L: 'Velké' };

const inputCls =
  'rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

function newCell(kind: LabelCellKind): LabelCell {
  return {
    id: kind === 'custom' ? `custom-${Date.now().toString(36)}` : kind,
    kind,
    ...(kind === 'custom' ? { text: '' } : {}),
    size: kind === 'name' ? 'L' : kind === 'code' ? 'M' : 'S',
    bold: kind === 'name' || kind === 'code',
    maxLines: kind === 'name' ? 2 : 1,
  };
}

/**
 * Editor šablon štítků: formát z roletky → šablona s buňkami (předvyplněné
 * údaje položky + vlastní pevné texty), živý náhled stejnou funkcí jako tisk.
 */
export function LabelEditor({ initial }: { initial: LabelTemplatesView }) {
  const router = useRouter();
  const [view, setView] = useState(initial);
  const [formatKey, setFormatKey] = useState(initial.defaultFormat);
  const [cells, setCells] = useState<LabelCell[]>(
    () => templateFor(initial, initial.defaultFormat).cells,
  );
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [addKind, setAddKind] = useState<LabelCellKind>('custom');

  const format = findLabelFormat(formatKey) ?? LABEL_FORMATS[0];
  const stored = view.templates.find((t) => t.formatKey === format.key);
  const isDefault = view.defaultFormat === format.key;
  const usedPresets = new Set<LabelCellKind>(cells.map((c) => c.kind));
  const addable: LabelCellKind[] = [
    ...LABEL_PRESET_KINDS.filter((k) => !usedPresets.has(k)),
    'custom',
  ];

  function update(next: LabelCell[]) {
    setCells(next);
    setDirty(true);
    setSaved(false);
    setError(null);
  }

  function patch(id: string, changes: Partial<LabelCell>) {
    update(cells.map((c) => (c.id === id ? { ...c, ...changes } : c)));
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= cells.length) return;
    const next = [...cells];
    [next[index], next[target]] = [next[target], next[index]];
    update(next);
  }

  function selectFormat(key: string) {
    if (dirty && !window.confirm('Máš neuložené změny šablony. Opravdu přepnout formát?')) return;
    setFormatKey(key);
    setCells(templateFor(view, key).cells);
    setDirty(false);
    setSaved(false);
    setError(null);
  }

  async function call(path: string, method: 'PUT' | 'DELETE', body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/label-templates/${encodeURIComponent(path)}`, {
        method,
        headers: { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as
        (LabelTemplatesView & { message?: string | string[] }) | null;
      if (!res.ok || !json) {
        const msg = Array.isArray(json?.message) ? json?.message.join(', ') : json?.message;
        throw new Error(msg || 'Uložení se nepovedlo.');
      }
      setView(json);
      router.refresh();
      return json;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Uložení se nepovedlo.');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    try {
      normalizeLabelCells(cells);
    } catch (err) {
      setError((err as Error).message);
      return;
    }
    if (cells.length === 0) {
      setError('Šablona musí mít aspoň jednu buňku.');
      return;
    }
    const next = await call(format.key, 'PUT', { cells });
    if (next) {
      setCells(templateFor(next, format.key).cells);
      setDirty(false);
      setSaved(true);
    }
  }

  async function reset() {
    if (!window.confirm('Vrátit tento formát na výchozí šablonu?')) return;
    const next = await call(format.key, 'DELETE');
    if (next) {
      setCells(templateFor(next, format.key).cells);
      setDirty(false);
      setSaved(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* Levý sloupec: formát + buňky */}
      <div className="flex min-w-0 flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Formát štítku</span>
          <select
            value={format.key}
            onChange={(e) => selectFormat(e.target.value)}
            className={inputCls}
          >
            <optgroup label="Tiskárna Niimbot">
              {LABEL_FORMATS.filter((f) => f.kind === 'niimbot').map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                  {view.defaultFormat === f.key ? ' – výchozí' : ''}
                </option>
              ))}
            </optgroup>
            <optgroup label="Arch A4 (tiskárna)">
              {LABEL_FORMATS.filter((f) => f.kind === 'sheet').map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                  {view.defaultFormat === f.key ? ' – výchozí' : ''}
                </option>
              ))}
            </optgroup>
          </select>
        </label>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {isDefault ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 font-medium text-brand-700 ring-1 ring-inset ring-brand-200">
              <Star size={12} /> Výchozí formát pro tisk
            </span>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void call('default-format', 'PUT', { formatKey: format.key })}
              className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <Star size={12} /> Nastavit jako výchozí pro tisk
            </button>
          )}
          <span className="text-slate-500">
            {stored?.custom ? 'Vlastní šablona' : 'Výchozí šablona'}
            {format.niimbot && !format.niimbot.verified ? ' · rozměr zatím neověřený tiskem' : ''}
          </span>
        </div>

        <ol className="flex flex-col gap-3">
          {cells.map((cell, i) => (
            <li key={cell.id} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                  {LABEL_CELL_LABELS[cell.kind]}
                </span>
                <button
                  type="button"
                  aria-label="Posunout nahoru"
                  disabled={i === 0}
                  onClick={() => move(i, -1)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  type="button"
                  aria-label="Posunout dolů"
                  disabled={i === cells.length - 1}
                  onClick={() => move(i, 1)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  type="button"
                  aria-label="Odebrat buňku"
                  onClick={() => update(cells.filter((c) => c.id !== cell.id))}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {cell.kind === 'custom' && (
                <input
                  value={cell.text ?? ''}
                  maxLength={LABEL_CUSTOM_TEXT_MAX}
                  placeholder="Např. Majetek firmy XY · tel. 123 456 789"
                  onChange={(e) => patch(cell.id, { text: e.target.value })}
                  className={`${inputCls} mt-2 w-full`}
                />
              )}

              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <div className="inline-flex overflow-hidden rounded-lg ring-1 ring-inset ring-slate-300">
                  {(['S', 'M', 'L'] as const).map((size) => (
                    <button
                      key={size}
                      type="button"
                      aria-pressed={cell.size === size}
                      onClick={() => patch(cell.id, { size })}
                      className={`px-2.5 py-1.5 text-xs font-medium ${cell.size === size ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                    >
                      {SIZE_LABELS[size]}
                    </button>
                  ))}
                </div>
                <label className="inline-flex items-center gap-1.5 text-slate-700">
                  <input
                    type="checkbox"
                    checked={cell.bold}
                    onChange={(e) => patch(cell.id, { bold: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600"
                  />
                  Tučně
                </label>
                <label className="inline-flex items-center gap-1.5 text-slate-700">
                  Řádky
                  <select
                    value={cell.maxLines}
                    onChange={(e) =>
                      patch(cell.id, { maxLines: Number(e.target.value) as 1 | 2 | 3 })
                    }
                    className="rounded-md border border-slate-300 bg-white px-1.5 py-1 text-sm"
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                  </select>
                </label>
              </div>
            </li>
          ))}
        </ol>

        {cells.length < LABEL_MAX_CELLS && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={addable.includes(addKind) ? addKind : 'custom'}
              onChange={(e) => setAddKind(e.target.value as LabelCellKind)}
              className={inputCls}
            >
              {addable.map((k) => (
                <option key={k} value={k}>
                  {LABEL_CELL_LABELS[k]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() =>
                update([...cells, newCell(addable.includes(addKind) ? addKind : 'custom')])
              }
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Plus size={16} /> Přidat buňku
            </button>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !dirty}
            onClick={() => void save()}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : saved ? (
              <Check size={16} />
            ) : (
              <Save size={16} />
            )}
            {saved && !dirty ? 'Uloženo' : 'Uložit šablonu'}
          </button>
          <button
            type="button"
            disabled={busy || (!stored?.custom && !dirty)}
            onClick={() => {
              if (!stored?.custom) {
                setCells(defaultLabelTemplate(format.key).cells);
                setDirty(false);
                return;
              }
              void reset();
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RotateCcw size={16} /> Výchozí šablona
          </button>
        </div>
      </div>

      {/* Pravý sloupec: živý náhled */}
      <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
        <p className="mb-2 text-sm font-medium text-slate-700">Náhled</p>
        <LabelPreview
          data={SAMPLE}
          formatKey={format.key}
          template={{ formatKey: format.key, cells }}
          className="mx-auto max-w-md"
        />
        <p className="mt-2 text-center text-xs text-slate-500">
          {format.widthMm} × {format.heightMm} mm
          {format.kind === 'niimbot' ? ' · termotisk (černobíle)' : ' · arch A4'} · ukázková položka
        </p>
      </div>
    </div>
  );
}
