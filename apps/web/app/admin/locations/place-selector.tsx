'use client';
import { useState } from 'react';
import { locationPath, type PlaceNode } from '../../lib/location-path';
import { CodeInput } from '../scan/code-input';
import { LOCATION_TYPES_BY_CATEGORY } from './location-types';

export function PlaceSelector({
  places,
  onPlaces,
  value,
  onChange,
  canCreate = false,
}: {
  places: PlaceNode[];
  onPlaces: (places: PlaceNode[]) => void;
  value: string;
  onChange: (id: string) => void;
  canCreate?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [parent, setParent] = useState<string | null>(null);
  const [mode, setMode] = useState<'browse' | 'scan' | 'new'>('browse');
  const [name, setName] = useState('');
  const [type, setType] = useState('box');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const available = places.filter(
    (p) => (p as PlaceNode & { type?: string }).type !== 'access_point',
  );
  const options = available.filter((p) =>
    query
      ? locationPath(p.id, places).toLocaleLowerCase('cs').includes(query.toLocaleLowerCase('cs'))
      : p.parentId === parent || (!parent && !places.some((a) => a.id === p.parentId)),
  );
  async function create() {
    if (busy || !name.trim()) return;
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), type, parentId: parent || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Místo se nepodařilo uložit.');
      onPlaces([...places, data]);
      onChange(data.id);
      setName('');
      setMode('browse');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chyba spojení.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-3">
      <p className="rounded-xl bg-brand-50 p-3 text-sm font-semibold text-brand-800" role="status">
        {value ? locationPath(value, places) : 'Místo zatím není vybrané'}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="action-secondary" onClick={() => setMode('browse')}>
          Vybrat místo
        </button>
        <button type="button" className="action-secondary" onClick={() => setMode('scan')}>
          Načíst místo
        </button>
        {canCreate && (
          <button
            type="button"
            className="action-secondary"
            onClick={() => {
              if (value) setParent(value);
              setMode('new');
            }}
          >
            Přidej místo
          </button>
        )}
      </div>
      {mode === 'browse' && (
        <>
          <input
            aria-label="Hledat místo podle celé cesty"
            className="field-input"
            placeholder="Hledej město, regál nebo box…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="flex items-center justify-between gap-2 text-sm">
            <span>{parent ? locationPath(parent, places) : 'Celá firma'}</span>
            {parent && (
              <button
                type="button"
                className="action-secondary"
                onClick={() => setParent(places.find((p) => p.id === parent)?.parentId ?? null)}
              >
                O úroveň výš
              </button>
            )}
          </div>
          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {options.map((p) => (
              <li key={p.id} className="flex gap-2 rounded-xl border border-slate-200 p-2">
                <button
                  type="button"
                  aria-pressed={value === p.id}
                  className={`min-h-12 flex-1 rounded-lg px-2 text-left text-sm ${value === p.id ? 'bg-brand-50 text-brand-800' : ''}`}
                  onClick={() => onChange(p.id)}
                >
                  {query ? locationPath(p.id, places) : p.name}
                </button>
                <button
                  type="button"
                  aria-label={`Otevřít ${p.name}`}
                  className="action-secondary"
                  onClick={() => {
                    setParent(p.id);
                    setQuery('');
                  }}
                >
                  →
                </button>
              </li>
            ))}
          </ul>
          {!options.length && (
            <p className="text-sm text-slate-500">
              Žádná podřízená místa. Můžeš vybrat jiné místo nebo vytvořit nové.
            </p>
          )}
        </>
      )}
      {mode === 'scan' && (
        <CodeInput
          label="Načti štítek místnosti, regálu nebo boxu"
          onRead={(code) => {
            setError('');
            try {
              const url = new URL(code, window.location.origin);
              const id =
                url.origin === window.location.origin
                  ? url.pathname.match(/^\/admin\/locations\/([\da-f-]{36})\/?$/i)?.[1]
                  : undefined;
              const selected = available.find((p) => p.id === id || p.id === code);
              if (!selected) throw new Error('Kód nepatří k dostupnému místu této firmy.');
              onChange(selected.id);
              setMode('browse');
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Neplatný kód.');
            }
          }}
        />
      )}
      {mode === 'new' && canCreate && (
        <div className="space-y-3 rounded-xl border border-slate-200 p-3">
          <p className="text-sm">
            Nové místo v: <strong>{parent ? locationPath(parent, places) : 'Celá firma'}</strong>
          </p>
          <label className="block text-sm">
            Nadřazené místo
            <select
              className="field-input"
              value={parent ?? ''}
              onChange={(e) => setParent(e.target.value || null)}
            >
              <option value="">Celá firma</option>
              {available.map((p) => (
                <option key={p.id} value={p.id}>
                  {locationPath(p.id, places)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Název místa
            <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block text-sm">
            Typ místa
            <select className="field-input" value={type} onChange={(e) => setType(e.target.value)}>
              {Object.entries(LOCATION_TYPES_BY_CATEGORY)
                .filter(([category]) => category !== 'access')
                .map(([, types]) => types)
                .flat()
                .map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
            </select>
          </label>
          <button
            type="button"
            className="action-primary"
            disabled={busy || !name.trim()}
            onClick={() => void create()}
          >
            {busy ? 'Ukládám…' : 'Vytvořit a vybrat'}
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
