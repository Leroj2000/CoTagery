import { Contact } from 'lucide-react';
import { apiFetch } from '../../lib/server-api';
import type { Person } from '../../lib/types';
import { PageHeader, Section, Table } from '../ui';
import { ActionForm } from '../action-form';
import { createPerson } from '../actions';

export const dynamic = 'force-dynamic';

export default async function PeoplePage() {
  const people = await apiFetch<Person[]>('/people');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Lidé"
        description="Osoby (Party) – lidé bez nutnosti účtu (příjemci, subdodavatelé)."
        icon={<Contact size={18} />}
      />

      <Section title="Nová osoba">
        <ActionForm
          action={createPerson}
          submitLabel="Vytvořit osobu"
          fields={[
            { name: 'name', label: 'Jméno', required: true },
            { name: 'email', label: 'E-mail', type: 'email' },
            { name: 'phone', label: 'Telefon' },
            { name: 'company', label: 'Firma' },
          ]}
        />
      </Section>

      <Section title={`Osoby (${people.length})`}>
        <Table
          head={['Jméno', 'E-mail', 'Telefon', 'Firma']}
          rows={people.map((p) => [p.name, p.email ?? '—', p.phone ?? '—', p.company ?? '—'])}
        />
      </Section>
    </div>
  );
}
