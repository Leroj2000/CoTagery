'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, CircleMarker } from 'leaflet';
import 'leaflet/dist/leaflet.css';

export type ManualCapture =
  | { manualLocationId: string }
  | {
      position: { latitude: number; longitude: number; capturedAt: string; source: 'manual' };
    };

function PointPicker({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const callback = useRef(onPick);
  callback.current = onPick;
  const [error, setError] = useState('');
  useEffect(() => {
    let disposed = false;
    let map: LeafletMap | undefined;
    let marker: CircleMarker | undefined;
    void import('leaflet')
      .then((L) => {
        if (disposed || !container.current) return;
        map = L.map(container.current).setView([49.8, 15.5], 7);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        })
          .on('tileerror', () =>
            setError(
              'Mapové podklady nejsou dostupné. Můžete vybrat evidované místo nebo pokračovat bez polohy.',
            ),
          )
          .addTo(map);
        const select = (lat: number, lng: number) => {
          const wrapped = L.latLng(lat, lng).wrap();
          marker?.remove();
          marker = L.circleMarker(wrapped, { radius: 8 }).addTo(map!);
          callback.current(wrapped.lat, wrapped.lng);
        };
        map.on('click', (event) => select(event.latlng.lat, event.latlng.lng));
        // Keyboard users can pan/zoom the focused map and select its center with Enter.
        map.on('keypress', (event) => {
          if (event.originalEvent.key === 'Enter') {
            const center = map!.getCenter();
            select(center.lat, center.lng);
          }
        });
      })
      .catch(() =>
        setError('Mapu se nepodařilo načíst. Vyberte evidované místo nebo pokračujte bez polohy.'),
      );
    return () => {
      disposed = true;
      map?.remove();
    };
  }, []);
  return (
    <>
      <p className="text-xs">
        Klikněte na bod. Klávesnicí: šipky posouvají mapu, +/- mění přiblížení, Enter vybere střed.
      </p>
      <div
        ref={container}
        aria-label="Mapa pro ruční výběr polohy"
        className="relative z-0 h-72 rounded border"
      />
      {error && <p role="alert">{error}</p>}
    </>
  );
}

export function ManualPosition({
  locations,
  locationsAvailable,
  busy,
  onSubmit,
  onSkip,
  onCancel,
}: {
  locations: { id: string; name: string }[];
  locationsAvailable: boolean;
  busy: boolean;
  onSubmit: (value: ManualCapture) => void;
  onSkip: () => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<'place' | 'map'>('place');
  const [place, setPlace] = useState('');
  const [point, setPoint] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showMap, setShowMap] = useState(false);
  return (
    <section
      className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
      aria-label="Doplnění polohy skenu"
    >
      <p className="font-medium">
        Poloha nebyla přiložena. Doplňte ji ručně, nebo pokračujte bez ní.
      </p>
      <label>
        Způsob zadání{' '}
        <select
          value={mode}
          disabled={busy}
          onChange={(e) => setMode(e.target.value as 'place' | 'map')}
          className="rounded border p-2"
        >
          <option value="place">Evidované místo</option>
          <option value="map">Bod na mapě</option>
        </select>
      </label>
      {mode === 'place' ? (
        <>
          <label>
            Místo{' '}
            <select
              value={place}
              disabled={busy}
              onChange={(e) => setPlace(e.target.value)}
              className="w-full rounded border p-2"
            >
              <option value="">Vyberte místo</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          {!locationsAvailable ? (
            <p>Seznam míst není dostupný nebo k němu nemáte přístup.</p>
          ) : (
            !locations.length && <p>Zatím nejsou evidovaná žádná místa.</p>
          )}
        </>
      ) : (
        <>
          <p className="text-xs">
            Mapa používá OpenStreetMap. Po otevření se poskytovateli odesílá vaše IP adresa a
            požadovaná oblast mapy.
          </p>
          {!showMap ? (
            <button type="button" onClick={() => setShowMap(true)}>
              Otevřít mapu
            </button>
          ) : (
            <PointPicker onPick={(latitude, longitude) => setPoint({ latitude, longitude })} />
          )}
          {point && (
            <p>
              Vybraný bod: {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
            </p>
          )}
        </>
      )}
      <p className="text-xs">
        Uloží se jako „Zadáno ručně“. Nezmění evidované umístění ani držitele položky.
      </p>
      <button
        type="button"
        disabled={busy || (mode === 'place' ? !place : !point)}
        className="rounded bg-brand-600 p-2 text-white disabled:opacity-50"
        onClick={() =>
          onSubmit(
            mode === 'place'
              ? { manualLocationId: place }
              : { position: { ...point!, source: 'manual', capturedAt: new Date().toISOString() } },
          )
        }
      >
        Dokončit sken s ruční polohou
      </button>
      <button type="button" disabled={busy} onClick={onSkip}>
        Pokračovat bez polohy
      </button>
      <button type="button" disabled={busy} onClick={onCancel}>
        Zrušit sken
      </button>
    </section>
  );
}
