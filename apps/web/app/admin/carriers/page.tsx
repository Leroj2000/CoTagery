import { apiFetch } from '../../lib/server-api';
import type { DataCarrier, DigitalObject } from '../../lib/types';
import { MODULE_OPTIONS } from '../options';
import { Section, Table, Badge, Mono } from '../ui';
import { ActionForm } from '../action-form';
import { generatePool, claimCarrier } from '../actions';

export const dynamic = 'force-dynamic';

export default async function CarriersPage() {
  const [unassigned, objects] = await Promise.all([
    apiFetch<DataCarrier[]>('/carriers/unassigned'),
    apiFetch<DigitalObject[]>('/objects'),
  ]);

  const codeOptions = unassigned.map((c) => ({ value: c.publicCode, label: c.publicCode }));
  const objectOptions = objects.map((o) => ({ value: o.id, label: `${o.slug} (${o.moduleType})` }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Identifikátory (pool)</h1>
        <p className="text-sm text-neutral-500">
          Předgenerované nepřiřazené identifikátory, self-aktivace (PIN) a claim na objekt.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Vygenerovat pool">
          <ActionForm
            action={generatePool}
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
              {
                name: 'selfActivatable',
                label: 'Self-aktivace (PIN)',
                options: [
                  { value: 'false', label: 'Ne' },
                  { value: 'true', label: 'Ano' },
                ],
              },
              { name: 'moduleTemplate', label: 'Modul při aktivaci', options: MODULE_OPTIONS },
            ]}
          />
        </Section>

        <Section title="Claim identifikátoru na objekt">
          {unassigned.length === 0 || objects.length === 0 ? (
            <p className="text-sm text-neutral-400">Potřebuješ nepřiřazený identifikátor a objekt.</p>
          ) : (
            <ActionForm
              action={claimCarrier}
              submitLabel="Přiřadit"
              fields={[
                { name: 'publicCode', label: 'Kód identifikátoru', required: true, options: codeOptions },
                { name: 'objectId', label: 'Objekt', required: true, options: objectOptions },
              ]}
            />
          )}
        </Section>
      </div>

      <Section title={`Nepřiřazené identifikátory (${unassigned.length})`}>
        <Table
          head={['Kód', 'Typ', 'Self-aktivace', 'Modul']}
          rows={unassigned.map((c) => [
            <Mono key="c">{c.publicCode}</Mono>,
            c.carrierType,
            c.selfActivatable ? <Badge key="s">PIN</Badge> : '—',
            c.moduleTemplate ?? '—',
          ])}
        />
      </Section>
    </div>
  );
}
