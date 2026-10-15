'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Clock3, MapPin } from 'lucide-react';
import type { Observation } from '../../../lib/types';
import { Badge } from '../../ui';

const SOURCE: Record<string, string> = { scan: 'Sken', inventory: 'Inventura' };

function dateTime(value: string): string {
  return new Date(value).toLocaleString('cs-CZ', { timeZone: 'Europe/Prague' });
}

export function LastObservationCard({
  assetId,
  observation,
}: {
  assetId: string;
  observation: Observation;
}) {
  const position = observation.captureContext?.position;
  const [address, setAddress] = useState(observation.addressLabel);
  const [resolving, setResolving] = useState(Boolean(position && !observation.addressLabel));

  useEffect(() => {
    if (!position || observation.addressLabel) return;
    let cancelled = false;
    void fetch(`/api/assets/${assetId}/observations/${observation.id}/address`, { method: 'POST' })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return (await response.json()) as { addressLabel: string | null };
      })
      .then((result) => {
        if (!cancelled) setAddress(result.addressLabel);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setResolving(false);
      });
    return () => {
      cancelled = true;
    };
  }, [assetId, observation.addressLabel, observation.id, position]);

  const fallbackCoordinates = position
    ? `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}`
    : null;
  const place = address ?? observation.locationName ?? fallbackCoordinates ?? 'Poloha neuvedena';

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-brand-600 shadow-sm ring-1 ring-slate-200">
            <MapPin size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-slate-900">
              {resolving ? 'Určuji nejbližší adresu…' : place}
            </p>
            <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
              <Clock3 size={12} /> {dateTime(observation.observedAt)}
              {position?.source === 'manual' ? ' · zadáno ručně' : ''}
              {position?.accuracyMeters != null
                ? ` · přesnost ±${Math.round(position.accuracyMeters)} m`
                : ''}
            </p>
          </div>
          <Badge tone="slate">
            {SOURCE[observation.source] ?? observation.source}
            {observation.actorName ? ` · ${observation.actorName}` : ''}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        {position ? (
          <p className="text-[11px] text-slate-400">
            Adresa ©{' '}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
              className="hover:underline"
            >
              OpenStreetMap
            </a>
          </p>
        ) : (
          <span />
        )}
        <Link
          href={`/admin/assets/${assetId}/positions`}
          className="text-sm font-medium text-brand-700 hover:underline"
        >
          Historie poloh →
        </Link>
      </div>
    </div>
  );
}
