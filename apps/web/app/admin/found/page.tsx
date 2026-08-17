import { MapPinned } from 'lucide-react';
import { apiFetch } from '../../lib/server-api';
import type { FoundReport } from '../../lib/types';
import { PageHeader, Section, Table, Badge, Mono, EmptyState } from '../ui';
import { ActionButton } from '../action-button';
import { handleFoundReport } from '../actions';

export const dynamic = 'force-dynamic';

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('cs-CZ');
}

export default async function FoundPage() {
  const reports = await apiFetch<FoundReport[]>('/found-reports');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Nahlášené nálezy"
        description="Zprávy od nálezců, kteří naskenovali QR bez přihlášení (§ public tag)."
        icon={<MapPinned size={18} />}
      />

      <Section title={`Nálezy (${reports.length})`}>
        {reports.length === 0 ? (
          <EmptyState>Zatím žádné nálezy.</EmptyState>
        ) : (
          <Table
            head={['Kdy', 'Kód', 'Zpráva', 'Kontakt', 'Stav', 'Akce']}
            rows={reports.map((r) => [
              fmtDateTime(r.createdAt),
              <Mono key="c">{r.publicCode}</Mono>,
              r.message,
              r.finderContact ?? '—',
              r.status === 'new' ? <Badge tone="amber">nový</Badge> : <Badge tone="green">vyřízeno</Badge>,
              r.status === 'new' ? (
                <ActionButton key="h" action={handleFoundReport} hidden={{ id: r.id }} label="Vyřídit" />
              ) : (
                '—'
              ),
            ])}
          />
        )}
      </Section>
    </div>
  );
}
