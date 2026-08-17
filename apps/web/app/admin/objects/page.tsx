import Link from 'next/link';
import { apiFetch } from '../../lib/server-api';
import type { DigitalObject } from '../../lib/types';
import { MODULE_OPTIONS } from '../options';
import { Section, Table, Badge, Mono } from '../ui';
import { ActionForm } from '../action-form';
import { createObject, generateCarriers } from '../actions';

export const dynamic = 'force-dynamic';

export default async function ObjectsPage() {
  const objects = await apiFetch<DigitalObject[]>('/objects');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Objekty a identifikátory</h1>
        <p className="text-sm text-neutral-500">Digitální objekty a jejich QR/NFC identifikátory.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Nový objekt">
          <ActionForm
            action={createObject}
            submitLabel="Vytvořit objekt"
            fields={[
              { name: 'moduleType', label: 'Modul', required: true, options: MODULE_OPTIONS },
              { name: 'slug', label: 'Slug (volitelně)', placeholder: 'napr-vip-karta' },
              { name: 'primaryUrl', label: 'Primární URL (volitelně)', type: 'url' },
            ]}
          />
        </Section>

        <Section title="Vygenerovat identifikátory (batch)">
          <ActionForm
            action={generateCarriers}
            submitLabel="Vygenerovat"
            fields={[
              { name: 'count', label: 'Počet', type: 'number', required: true, placeholder: '10' },
              {
                name: 'carrierType',
                label: 'Typ',
                options: [
                  { value: 'qr', label: 'QR' },
                  { value: 'nfc', label: 'NFC' },
                  { value: 'hybrid', label: 'Hybrid' },
                ],
              },
            ]}
          />
        </Section>
      </div>

      <Section title={`Objekty (${objects.length})`}>
        <Table
          head={['Modul', 'Slug', 'Stav', 'URL']}
          rows={objects.map((o) => [
            <Badge key="m">{o.moduleType}</Badge>,
            <Link key="s" href={`/admin/objects/${o.id}`} className="font-mono text-xs text-blue-600 hover:underline">
              {o.slug}
            </Link>,
            o.status,
            o.primaryUrl ? <Mono key="u">{o.primaryUrl}</Mono> : '—',
          ])}
        />
      </Section>
    </div>
  );
}
