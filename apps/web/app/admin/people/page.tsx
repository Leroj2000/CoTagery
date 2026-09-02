import { Contact, UserRound } from 'lucide-react';
import { apiFetch, getMyPermissions } from '../../lib/server-api';
import type { Person } from '../../lib/types';
import { PageHeader, Section, EmptyState } from '../ui';
import { InlineEdit } from '../inline-edit';
import { updatePerson } from '../actions';
import { PersonForm } from './person-form';

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
          <PersonForm />
        </Section>
      )}

      <Section title={`Osoby (${people.length})`}>
        {people.length === 0 ? (
          <EmptyState>Zatím žádné osoby.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {people.map((p) => (
              <li
                key={p.id}
                className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-slate-400">
                  {p.photoFileKey ? (
                    <img
                      src={`/api/person-photo/${p.id}`}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <UserRound size={20} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{p.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    {[p.email, p.phone, p.company].filter(Boolean).join(' · ') || '—'}
                  </p>
                </div>
                {canManage && (
                  <div className="shrink-0">
                    <InlineEdit
                      action={updatePerson}
                      id={p.id}
                      fields={[
                        { name: 'name', label: 'Jméno', defaultValue: p.name },
                        { name: 'email', label: 'E-mail', type: 'email', defaultValue: p.email ?? '' },
                        { name: 'phone', label: 'Telefon', defaultValue: p.phone ?? '' },
                        { name: 'company', label: 'Firma', defaultValue: p.company ?? '' },
                      ]}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
