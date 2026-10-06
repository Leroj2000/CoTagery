'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Asset, Location, Person } from '../../lib/types';
import { locationPath } from '../../lib/location-path';
import { StatusBadge } from '../ui';

export function Finder({
  assets,
  places,
  people,
}: {
  assets: Asset[];
  places: Location[];
  people: Person[];
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLocaleLowerCase('cs');
  const [remote, setRemote] = useState<{ query: string; items: Asset[]; total: number } | null>(
    null,
  );
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    const timer = setTimeout(() => {
      void fetch(`/api/find?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then(async (res) => {
          if (!res.ok) throw new Error();
          return res.json() as Promise<{ items: Asset[]; total: number }>;
        })
        .then((data) => {
          if (!controller.signal.aborted) setRemote({ query: q, ...data });
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setError(
              'Celé vyhledávání není dostupné. Zobrazuji jen výsledky z načteného přehledu.',
            );
        });
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q]);
  const path = new Map(places.map((p) => [p.id, locationPath(p.id, places)]));
  const holder = (a: Asset) =>
    a.currentHolderType === 'location'
      ? path.get(a.currentHolderId ?? '')
      : a.currentHolderType === 'person'
        ? people.find((p) => p.id === a.currentHolderId)?.name
        : assets.find((p) => p.id === a.currentHolderId)?.name;
  const local = assets.filter((a) =>
    [
      a.name,
      a.inventoryNumber,
      a.serialNumber,
      a.category,
      path.get(a.homeLocationId ?? ''),
      holder(a),
    ]
      .join(' ')
      .toLocaleLowerCase('cs')
      .includes(q),
  );
  const filtered = remote?.query === q ? remote.items : local;
  const locations = places.filter((p) =>
    q ? path.get(p.id)?.toLocaleLowerCase('cs').includes(q) : !p.parentId || !path.has(p.parentId),
  );
  return (
    <div className="space-y-5">
      <label className="block font-medium">
        Co hledáš?
        <input
          type="search"
          autoFocus
          className="field-input mt-2"
          placeholder="Název, sériové číslo, člověk nebo box…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <p role="status" className="text-sm text-slate-500">
        {remote?.query === q ? `${remote.total} položek` : 'Hledám v celé dostupné evidenci…'} ·{' '}
        {locations.length} míst
      </p>
      {error && (
        <p role="alert" className="text-sm text-amber-800">
          {error}
        </p>
      )}
      {remote?.query === q && remote.total > filtered.length && (
        <p className="text-sm text-slate-600">
          Zobrazeno prvních {filtered.length} výsledků. Zpřesni hledání.
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <section className="space-y-3">
          <h2 className="font-semibold">Položky</h2>
          {filtered.map((a) => (
            <Link
              key={a.id}
              href={`/admin/assets/${a.id}`}
              className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 hover:border-brand-300"
            >
              {a.photoKey && (
                <img
                  src={`/api/asset-photo/${a.id}`}
                  alt=""
                  className="h-16 w-16 rounded-xl object-contain"
                  loading="lazy"
                />
              )}
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{a.name}</p>
                <p className="text-sm text-slate-600">
                  {holder(a) || 'Aktuální umístění není známé'}
                </p>
                <p className="text-xs text-slate-500">
                  Patří do: {path.get(a.homeLocationId ?? '') || 'neurčeno'}
                </p>
              </div>
              <StatusBadge status={a.status} />
            </Link>
          ))}
          {!filtered.length && <p className="text-slate-500">Žádná položka neodpovídá hledání.</p>}
        </section>
        <section className="space-y-3">
          <h2 className="font-semibold">Místa</h2>
          {locations.map((p) => (
            <Link
              className="block rounded-xl border border-slate-200 bg-white p-4 text-sm font-medium hover:border-brand-300"
              href={`/admin/locations/${p.id}`}
              key={p.id}
            >
              {path.get(p.id)} →
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}
