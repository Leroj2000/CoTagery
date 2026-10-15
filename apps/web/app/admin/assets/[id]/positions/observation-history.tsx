'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock3, LocateFixed, MapPin, ScanLine } from 'lucide-react';
import type { CircleMarker, Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Observation } from '../../../../lib/types';
import { Badge, EmptyState } from '../../../ui';

const SOURCE: Record<string, string> = { scan: 'Sken', inventory: 'Inventura' };

function date(value: string): string {
  return new Date(value).toLocaleDateString('cs-CZ', {
    timeZone: 'Europe/Prague',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function time(value: string): string {
  return new Date(value).toLocaleTimeString('cs-CZ', {
    timeZone: 'Europe/Prague',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function coordinateLabel(observation: Observation): string | null {
  const position = observation.captureContext?.position;
  return position ? `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}` : null;
}

function ObservationMap({
  observations,
  selectedId,
}: {
  observations: Observation[];
  selectedId: string | null;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markers = useRef(new Map<string, CircleMarker>());
  const points = useMemo(
    () => observations.filter((item) => item.captureContext?.position),
    [observations],
  );
  const latestPoints = useRef(points);
  latestPoints.current = points;
  const pointKey = points
    .map((item) => {
      const position = item.captureContext!.position!;
      return `${item.id}:${position.latitude}:${position.longitude}`;
    })
    .join('|');

  useEffect(() => {
    if (!container.current || points.length === 0) return;
    let disposed = false;
    let map: LeafletMap | null = null;
    void import('leaflet').then((L) => {
      if (disposed || !container.current) return;
      map = L.map(container.current, { zoomControl: true });
      mapRef.current = map;
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      const bounds: [number, number][] = [];
      points.forEach((item) => {
        const position = item.captureContext!.position!;
        const latLng: [number, number] = [position.latitude, position.longitude];
        bounds.push(latLng);
        const marker = L.circleMarker(latLng, {
          radius: item.id === selectedId ? 10 : 7,
          color: '#0369a1',
          weight: 3,
          fillColor: '#0ea5e9',
          fillOpacity: 0.9,
        }).addTo(map!);
        const popup = document.createElement('div');
        const title = document.createElement('strong');
        const latest = latestPoints.current.find((candidate) => candidate.id === item.id) ?? item;
        title.textContent = latest.addressLabel ?? coordinateLabel(latest) ?? 'Poloha';
        const timestamp = document.createElement('div');
        timestamp.textContent = `${date(item.observedAt)} · ${time(item.observedAt)}`;
        popup.append(title, timestamp);
        marker.bindPopup(popup);
        markers.current.set(item.id, marker);
      });
      if (bounds.length === 1) map.setView(bounds[0], 17);
      else map.fitBounds(bounds, { padding: [32, 32], maxZoom: 17 });
    });
    return () => {
      disposed = true;
      markers.current.clear();
      mapRef.current = null;
      map?.remove();
    };
    // Coordinates are immutable; address hydration must not rebuild the map.
  }, [pointKey]);

  useEffect(() => {
    for (const item of points) {
      const marker = markers.current.get(item.id);
      if (!marker) continue;
      const popup = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = item.addressLabel ?? coordinateLabel(item) ?? 'Poloha';
      const timestamp = document.createElement('div');
      timestamp.textContent = `${date(item.observedAt)} · ${time(item.observedAt)}`;
      popup.append(title, timestamp);
      marker.setPopupContent(popup);
    }
  }, [points]);

  useEffect(() => {
    if (!selectedId) return;
    const marker = markers.current.get(selectedId);
    if (!marker || !mapRef.current) return;
    for (const [id, item] of markers.current) item.setRadius(id === selectedId ? 10 : 7);
    mapRef.current.setView(marker.getLatLng(), Math.max(mapRef.current.getZoom(), 17), {
      animate: true,
    });
    marker.openPopup();
  }, [selectedId]);

  if (points.length === 0) {
    return <EmptyState>Záznamy zatím neobsahují žádný GPS bod.</EmptyState>;
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
      <div ref={container} aria-label="Mapa historie poloh položky" className="h-[560px] w-full" />
      <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-400">
        Mapová data ©{' '}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
          className="hover:underline"
        >
          OpenStreetMap
        </a>
      </p>
    </div>
  );
}

export function ObservationHistory({
  assetId,
  observations,
}: {
  assetId: string;
  observations: Observation[];
}) {
  const [items, setItems] = useState(observations);
  const firstPoint = observations.find((item) => item.captureContext?.position);
  const [selectedId, setSelectedId] = useState<string | null>(firstPoint?.id ?? null);
  const [resolvingIds, setResolvingIds] = useState(
    () =>
      new Set(
        observations
          .filter((item) => item.captureContext?.position && !item.addressLabel)
          .map((item) => item.id),
      ),
  );

  useEffect(() => {
    let cancelled = false;
    const unresolved = observations.filter(
      (item) => item.captureContext?.position && !item.addressLabel,
    );
    void (async () => {
      for (const observation of unresolved) {
        if (cancelled) return;
        try {
          const response = await fetch(
            `/api/assets/${assetId}/observations/${observation.id}/address`,
            { method: 'POST' },
          );
          if (!response.ok) continue;
          const result = (await response.json()) as {
            addressLabel: string | null;
            addressResolvedAt: string | null;
          };
          if (!cancelled) {
            setItems((current) =>
              current.map((item) => (item.id === observation.id ? { ...item, ...result } : item)),
            );
          }
        } catch {
          // Souřadnice zůstává použitelná i při dočasně nedostupném geokódování.
        } finally {
          if (!cancelled) {
            setResolvingIds((current) => {
              const next = new Set(current);
              next.delete(observation.id);
              return next;
            });
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [assetId, observations]);

  if (items.length === 0) return <EmptyState>Zatím nebyla zaznamenána žádná poloha.</EmptyState>;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.4fr)]">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Poslední záznamy</h2>
            <p className="text-xs text-slate-500">Nejnovější jsou nahoře</p>
          </div>
          {resolvingIds.size > 0 && (
            <Badge tone="brand">Doplňuji adresy · {resolvingIds.size}</Badge>
          )}
        </div>
        <div className="max-h-[610px] divide-y divide-slate-100 overflow-y-auto">
          {items.map((item) => {
            const position = item.captureContext?.position;
            const coordinates = coordinateLabel(item);
            const label =
              item.addressLabel ??
              item.locationName ??
              (position
                ? resolvingIds.has(item.id)
                  ? 'Určuji nejbližší adresu…'
                  : (coordinates ?? 'Adresa není dostupná')
                : 'Bez GPS polohy');
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => position && setSelectedId(item.id)}
                className={`flex w-full gap-3 px-4 py-3 text-left transition ${
                  selectedId === item.id ? 'bg-brand-50/70' : 'hover:bg-slate-50'
                } ${position ? '' : 'cursor-default'}`}
              >
                <span
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                    selectedId === item.id
                      ? 'bg-brand-600 text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {position ? <MapPin size={15} /> : <ScanLine size={15} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-slate-800">{label}</span>
                  <span className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                    <Clock3 size={11} /> {date(item.observedAt)} · {time(item.observedAt)}
                  </span>
                  <span className="mt-1 block text-[11px] text-slate-400">
                    {SOURCE[item.source] ?? item.source}
                    {item.actorName ? ` · ${item.actorName}` : ''}
                    {position?.source === 'manual' ? ' · ručně' : ''}
                    {position?.accuracyMeters != null
                      ? ` · přesnost ±${Math.round(position.accuracyMeters)} m`
                      : ''}
                  </span>
                  {coordinates && item.addressLabel && (
                    <span className="mt-1 block text-[10px] text-slate-400">{coordinates}</span>
                  )}
                </span>
                {position && <LocateFixed size={14} className="mt-1 shrink-0 text-slate-300" />}
              </button>
            );
          })}
        </div>
      </section>

      <div className="lg:sticky lg:top-4">
        <ObservationMap observations={items} selectedId={selectedId} />
      </div>
    </div>
  );
}
