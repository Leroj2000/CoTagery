import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiFetch, ApiError } from '../../../lib/server-api';
import type { AccessPoint, AccessEvent } from '../../../lib/types';
import { Section, Table, Badge, Mono } from '../../ui';

export const dynamic = 'force-dynamic';

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString('cs-CZ');
}

export default async function AccessDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let point: AccessPoint;
  try {
    point = await apiFetch<AccessPoint>(`/access-points/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const events = await apiFetch<AccessEvent[]>(`/access-points/${id}/events`);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/admin/access" className="text-xs text-neutral-500 hover:underline">
          ← Přístup
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{point.name}</h1>
        <p className="text-sm text-neutral-500">
          zóna <Badge>{point.zoneKey}</Badge> · směr {point.direction}
        </p>
      </div>

      <Section title={`Audit vstupů (${events.length})`}>
        <Table
          head={['Čas', 'Subjekt', 'Ref', 'Rozhodnutí', 'Důvod']}
          rows={events.map((e) => [
            fmtTime(e.createdAt),
            e.subjectType,
            <Mono key="ref">{e.subjectRef.slice(0, 8)}…</Mono>,
            <Badge key="d">{e.decision}</Badge>,
            e.reason ?? '—',
          ])}
        />
      </Section>
    </div>
  );
}
