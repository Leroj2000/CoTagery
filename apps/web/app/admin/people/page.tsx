import { Contact } from 'lucide-react';
import { apiFetch, getMyPermissions } from '../../lib/server-api';
import type { Person } from '../../lib/types';
import { PageHeader, Section, Table } from '../ui';
import { ActionForm } from '../action-form';
import { InlineEdit } from '../inline-edit';
import { createPerson, updatePerson } from '../actions';

export const dynamic = 'force-dynamic';

export default async function PeoplePage() {
  const [people, perms] = await Promise.all([apiFetch<Person[]>('/people'), getMyPermissions()]);
  const canManage = perms.has('core.person.manage');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Lidé"
        description="Osoby (Party) – lidé bez nutnosti účtu (příjemci, subdodavatelé)."
        icon={<Contact size={18} />}
      />

      {canManage && (
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
      )}

      <Section title={`Osoby (${people.length})`}>
        <Table
          head={canManage ? ['Jméno', 'E-mail', 'Telefon', 'Firma', 'Akce'] : ['Jméno', 'E-mail', 'Telefon', 'Firma']}
          rows={people.map((p) => {
            const base = [p.name, p.email ?? '—', p.phone ?? '—', p.company ?? '—'];
            if (!canManage) return base;
            return [
              ...base,
              <InlineEdit
                key="e"
                action={updatePerson}
                id={p.id}
                fields={[
                  { name: 'name', label: 'Jméno', defaultValue: p.name },
                  { name: 'email', label: 'E-mail', type: 'email', defaultValue: p.email ?? '' },
                  { name: 'phone', label: 'Telefon', defaultValue: p.phone ?? '' },
                  { name: 'company', label: 'Firma', defaultValue: p.company ?? '' },
                ]}
              />,
            ];
          })}
        />
      </Section>
    </div>
  );
}
