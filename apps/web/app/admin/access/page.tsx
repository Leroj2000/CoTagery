import Link from 'next/link';
import { apiFetch } from '../../lib/server-api';
import type { AccessPoint } from '../../lib/types';
import { Section, Table, Badge, Mono } from '../ui';
import { ActionForm } from '../action-form';
import { createAccessPoint } from '../actions';

export const dynamic = 'force-dynamic';

export default async function AccessPage() {
  const points = await apiFetch<AccessPoint[]>('/access-points');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Přístup</h1>
        <p className="text-sm text-neutral-500">Přístupové body a zóny (Access-Control).</p>
      </div>

      <Section title="Nový přístupový bod">
        <ActionForm
          action={createAccessPoint}
          submitLabel="Vytvořit"
          fields={[
            { name: 'name', label: 'Název', required: true, placeholder: 'VIP brána' },
            { name: 'zoneKey', label: 'Zóna (zone_key)', required: true, placeholder: 'vip' },
            {
              name: 'direction',
              label: 'Směr',
              options: [
                { value: 'in', label: 'Vstup' },
                { value: 'out', label: 'Výstup' },
                { value: 'both', label: 'Obojí' },
              ],
            },
          ]}
        />
      </Section>

      <Section title={`Přístupové body (${points.length})`}>
        <Table
          head={['Název', 'Zóna', 'Směr', 'ID']}
          rows={points.map((p) => [
            <Link key="n" href={`/admin/access/${p.id}`} className="text-blue-600 hover:underline">
              {p.name}
            </Link>,
            <Badge key="z">{p.zoneKey}</Badge>,
            p.direction,
            <Mono key="id">{p.id.slice(0, 8)}…</Mono>,
          ])}
        />
      </Section>
    </div>
  );
}
