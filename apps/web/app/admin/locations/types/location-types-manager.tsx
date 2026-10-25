'use client';

import { useState } from 'react';
import { Eye, EyeOff, Grid3x3, Loader2, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { SYSTEM_LOCATION_TYPES } from '@tagery/shared';
import { Badge, Section } from '../../ui';
import { LOCATION_CATEGORIES, type LocationTypeView } from '../location-types';

const inputCls =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10';
const iconBtn =
  'inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40';

const SYSTEM_NAME = new Map(SYSTEM_LOCATION_TYPES.map((t) => [t.key, t.name]));

/** Správa typů míst: přidání vlastního, přejmenování, skrytí, mřížka, smazání. */
export function LocationTypesManager({
  initial,
  canManage,
}: {
  initial: LocationTypeView[];
  canManage: boolean;
}) {
  const [types, setTypes] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [form, setForm] = useState({ name: '', category: 'storage', grid: false });

  async function call(key: string | null, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) {
    setBusy(key ?? 'new');
    setError(null);
    try {
      const res = await fetch(`/api/location-types${key ? `/${key}` : ''}`, {
        method,
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = (await res.json().catch(() => null)) as
        LocationTypeView[] | { message?: string | string[] } | null;
      if (!res.ok || !Array.isArray(data)) {
        const msg = data && !Array.isArray(data) ? data.message : null;
        throw new Error((Array.isArray(msg) ? msg[0] : msg) || 'Uložení selhalo');
      }
      setTypes(data);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Uložení selhalo');
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (await call(null, 'POST', form)) setForm((f) => ({ ...f, name: '' }));
  }

  async function rename(t: LocationTypeView) {
    if (await call(t.key, 'PATCH', { name: editName.trim() || (t.system ? null : t.name) }))
      setEditing(null);
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-100">
          {error}
        </p>
      )}

      {LOCATION_CATEGORIES.map((c) => {
        const items = types.filter((t) => t.category === c.value);
        return (
          <Section key={c.value} title={c.label}>
            <ul className="divide-y divide-slate-100">
              {items.map((t) => {
                const renamed = t.system && SYSTEM_NAME.get(t.key) !== t.name;
                return (
                  <li
                    key={t.key}
                    className={`flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:gap-3 ${t.hidden ? 'opacity-60' : ''}`}
                  >
                    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                      {editing === t.key ? (
                        <form
                          className="flex flex-wrap items-center gap-2"
                          onSubmit={(e) => {
                            e.preventDefault();
                            void rename(t);
                          }}
                        >
                          <input
                            autoFocus
                            className={`${inputCls} w-48 py-1`}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder={t.system ? SYSTEM_NAME.get(t.key) : ''}
                            maxLength={60}
                          />
                          <button type="submit" className={iconBtn} disabled={busy === t.key}>
                            {busy === t.key && <Loader2 size={13} className="animate-spin" />}{' '}
                            Uložit
                          </button>
                          <button
                            type="button"
                            className={iconBtn}
                            onClick={() => setEditing(null)}
                          >
                            Zrušit
                          </button>
                        </form>
                      ) : (
                        <span className="text-sm font-medium text-slate-800">{t.name}</span>
                      )}
                      {t.system ? (
                        <Badge tone="slate">systémový</Badge>
                      ) : (
                        <Badge tone="brand">vlastní</Badge>
                      )}
                      {renamed && (
                        <span className="text-xs text-slate-400">({SYSTEM_NAME.get(t.key)})</span>
                      )}
                      {t.grid && (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                          <Grid3x3 size={12} /> mřížka
                        </span>
                      )}
                      {t.hidden && <Badge tone="amber">skrytý</Badge>}
                      <span className="text-xs text-slate-400">
                        {t.usage}{' '}
                        {t.usage === 1 ? 'místo' : t.usage >= 2 && t.usage <= 4 ? 'místa' : 'míst'}
                      </span>
                    </div>
                    {canManage && editing !== t.key && (
                      <div className="flex shrink-0 flex-wrap items-center gap-1">
                        <button
                          type="button"
                          className={iconBtn}
                          onClick={() => {
                            setEditing(t.key);
                            setEditName(t.name);
                          }}
                        >
                          <Pencil size={13} /> Přejmenovat
                        </button>
                        {!t.system && (
                          <button
                            type="button"
                            className={iconBtn}
                            disabled={busy === t.key}
                            onClick={() => void call(t.key, 'PATCH', { grid: !t.grid })}
                          >
                            <Grid3x3 size={13} /> {t.grid ? 'Bez mřížky' : 'S mřížkou'}
                          </button>
                        )}
                        <button
                          type="button"
                          className={iconBtn}
                          disabled={busy === t.key}
                          onClick={() => void call(t.key, 'PATCH', { hidden: !t.hidden })}
                        >
                          {t.hidden ? <Eye size={13} /> : <EyeOff size={13} />}
                          {t.hidden ? 'Zobrazit' : 'Skrýt'}
                        </button>
                        {t.system && (renamed || t.hidden) && (
                          <button
                            type="button"
                            className={iconBtn}
                            disabled={busy === t.key}
                            onClick={() => void call(t.key, 'DELETE')}
                          >
                            <RotateCcw size={13} /> Výchozí
                          </button>
                        )}
                        {!t.system && (
                          <button
                            type="button"
                            className={`${iconBtn} text-red-600 hover:bg-red-50`}
                            disabled={busy === t.key || t.usage > 0}
                            title={t.usage > 0 ? 'Typ používají místa – jen ho skryj' : undefined}
                            onClick={() => {
                              if (confirm(`Smazat typ „${t.name}"?`)) void call(t.key, 'DELETE');
                            }}
                          >
                            <Trash2 size={13} /> Smazat
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Section>
        );
      })}

      {canManage && (
        <Section title="Nový typ místa" description="Např. Kontejner, Dílna, Vozidlo, Šuplík.">
          <form onSubmit={add} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-600">Název</span>
              <input
                className={`${inputCls} w-full`}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                maxLength={60}
                required
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-600">Kategorie</span>
              <select
                className={inputCls}
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                {LOCATION_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="inline-flex items-center gap-2 pb-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.grid}
                onChange={(e) => setForm((f) => ({ ...f, grid: e.target.checked }))}
              />
              Dělí se na mřížku (police, přihrádky)
            </label>
            <button
              type="submit"
              disabled={busy === 'new' || !form.name.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
            >
              {busy === 'new' ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              Přidat typ
            </button>
          </form>
        </Section>
      )}
    </div>
  );
}
