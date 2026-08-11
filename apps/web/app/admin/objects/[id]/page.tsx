import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { apiFetch, ApiError } from '../../../lib/server-api';
import type { DigitalObject, DataCarrier } from '../../../lib/types';
import { Section, Table, Badge, Mono } from '../../ui';
import { ActionForm } from '../../action-form';
import { ActionButton } from '../../action-button';
import { addCarrierToObject, archiveObject } from '../../actions';

export const dynamic = 'force-dynamic';

export default async function ObjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let object: DigitalObject;
  try {
    object = await apiFetch<DigitalObject>(`/objects/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const carriers = await apiFetch<DataCarrier[]>(`/objects/${id}/carriers`);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/admin/objects" className="text-xs text-neutral-500 hover:underline">
            ← Objekty
          </Link>
          <h1 className="mt-1 text-xl font-semibold">{object.slug}</h1>
          <p className="text-sm text-neutral-500">
            <Badge>{object.moduleType}</Badge> · stav {object.status}
          </p>
        </div>
        {object.status !== 'archived' && (
          <ActionButton
            action={archiveObject}
            hidden={{ objectId: object.id }}
            label="Archivovat"
            variant="danger"
            confirm="Archivovat objekt?"
          />
        )}
      </div>

      <Section title="Přidat nosič">
        <ActionForm
          action={addCarrierToObject}
          hidden={{ objectId: object.id }}
          submitLabel="Přidat nosič"
          fields={[
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

      <Section title={`Nosiče (${carriers.length})`}>
        <Table
          head={['QR', 'Kód', 'Typ', 'Stav', 'Resolver URL']}
          rows={carriers.map((c) => [
            <Image
              key="qr"
              src={`/api/qr/${c.id}`}
              alt={c.publicCode}
              width={56}
              height={56}
              unoptimized
              className="rounded border border-neutral-200 bg-white"
            />,
            <Mono key="code">{c.publicCode}</Mono>,
            c.carrierType,
            <Badge key="st">{c.status}</Badge>,
            c.resolverUrl ? <Mono key="u">{c.resolverUrl}</Mono> : '—',
          ])}
        />
      </Section>
    </div>
  );
}
