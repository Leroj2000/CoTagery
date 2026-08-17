import { Webhook } from 'lucide-react';
import { apiFetch } from '../../lib/server-api';
import type { WebhookEndpoint, WebhookDelivery } from '../../lib/types';
import { PageHeader, Section, Table, Badge, Mono, EmptyState } from '../ui';
import { ActionForm } from '../action-form';
import { ActionButton } from '../action-button';
import { createWebhook, testWebhook, deleteWebhook } from '../actions';

export const dynamic = 'force-dynamic';

const EVENTS = ['movement.created', 'issue.reported', 'inventory.mismatch', 'found_report.created'];

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('cs-CZ');
}

export default async function WebhooksPage() {
  const [endpoints, deliveries] = await Promise.all([
    apiFetch<WebhookEndpoint[]>('/webhooks'),
    apiFetch<WebhookDelivery[]>('/webhooks/deliveries'),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Webhooky"
        description="Doménové události posílané do vašich systémů (n8n, Make, Zapier…)."
        icon={<Webhook size={18} />}
      />

      <Section title="Nový endpoint" description={`Události: ${EVENTS.join(', ')} (prázdné = vše)`}>
        <ActionForm
          action={createWebhook}
          submitLabel="Přidat endpoint"
          fields={[
            { name: 'url', label: 'URL', required: true, type: 'url', placeholder: 'https://…' },
            { name: 'events', label: 'Události (čárkou, prázdné = vše)', placeholder: 'movement.created, inventory.mismatch' },
          ]}
        />
      </Section>

      <Section title={`Endpointy (${endpoints.length})`}>
        {endpoints.length === 0 ? (
          <EmptyState>Zatím žádné endpointy.</EmptyState>
        ) : (
          <Table
            head={['URL', 'Události', 'Secret', 'Akce']}
            rows={endpoints.map((e) => [
              <Mono key="u">{e.url}</Mono>,
              e.events.length ? e.events.map((ev) => <Badge key={ev} tone="brand">{ev}</Badge>) : <Badge tone="slate">vše</Badge>,
              <Mono key="s">{e.secret.slice(0, 14)}…</Mono>,
              <span key="a" className="flex gap-1">
                <ActionButton action={testWebhook} hidden={{ id: e.id }} label="Test" />
                <ActionButton action={deleteWebhook} hidden={{ id: e.id }} label="Smazat" variant="danger" confirm="Smazat endpoint?" />
              </span>,
            ])}
          />
        )}
      </Section>

      <Section title={`Poslední doručení (${deliveries.length})`}>
        {deliveries.length === 0 ? (
          <EmptyState>Zatím žádná doručení.</EmptyState>
        ) : (
          <Table
            head={['Kdy', 'Událost', 'Stav', 'HTTP']}
            rows={deliveries.slice(0, 30).map((d) => [
              fmtDateTime(d.createdAt),
              <Mono key="e">{d.event}</Mono>,
              d.ok ? <Badge tone="green">OK</Badge> : <Badge tone="red">{d.error ?? 'chyba'}</Badge>,
              d.statusCode ?? '—',
            ])}
          />
        )}
      </Section>
    </div>
  );
}
