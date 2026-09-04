import { Contact, UserRound } from 'lucide-react';
import { apiFetch, ApiError, getMyPermissions } from '../../lib/server-api';
import type { AdminUser, Person, PersonCategory } from '../../lib/types';
import { PageHeader, Section, Badge, EmptyState } from '../ui';
import { InlineEdit } from '../inline-edit';
import { updatePerson } from '../actions';
import { PersonForm } from './person-form';
import { PersonPhotoEdit } from './person-photo-edit';
import { PersonCategoriesManager } from './person-categories-manager';
import { CategoryMultiEdit } from './category-multi-edit';

export const dynamic = 'force-dynamic';

interface Row {
  kind: 'person' | 'user';
  id: string;
  name: string;
  subtitle: string;
  categoryIds: string[];
  photoKey?: string | null;
  role?: string;
  person?: Person;
}

export default async function PeoplePage() {
  const [people, categories, perms] = await Promise.all([
    apiFetch<Person[]>('/people'),
    apiFetch<PersonCategory[]>('/person-categories').catch(() => [] as PersonCategory[]),
    getMyPermissions(),
  ]);
  // Uživatelé firmy (přes org_memberships) – patří do seznamu Lidé. Bez oprávnění
  // na výpis uživatelů se prostě nepřidají.
  const users = await apiFetch<AdminUser[]>('/users').catch((e) => {
    if (e instanceof ApiError && e.status === 403) return [] as AdminUser[];
    throw e;
  });
  const canManage = perms.has('core.person.manage');

  const rows: Row[] = [
    ...people.map(
      (p): Row => ({
        kind: 'person',
        id: p.id,
        name: p.name,
        subtitle: [p.email, p.phone, p.company].filter(Boolean).join(' · ') || '—',
        categoryIds: p.categoryIds ?? [],
        photoKey: p.photoFileKey,
        person: p,
      }),
    ),
    ...users.map(
      (u): Row => ({
        kind: 'user',
        id: u.id,
        name: u.name,
        subtitle: u.email,
        categoryIds: u.categoryIds ?? [],
        role: u.tenantRole,
      }),
    ),
  ].sort((a, b) => a.name.localeCompare(b.name, 'cs'));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Lidé"
        description="Osoby (Party) i uživatelé firmy – s možností zařazení do kategorií."
        icon={<Contact size={18} />}
      />

      {canManage && (
        <Section title="Nová osoba">
          <PersonForm categories={categories} />
        </Section>
      )}

      {canManage && (
        <Section title="Kategorie osob" description="Vlastní číselník – přidávej a maž dle potřeby.">
          <PersonCategoriesManager categories={categories} />
        </Section>
      )}

      <Section title={`Lidé (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyState>Zatím žádní lidé.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((r) => (
              <li
                key={`${r.kind}:${r.id}`}
                className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-slate-400">
                  {r.kind === 'person' && r.photoKey ? (
                    <img src={`/api/person-photo/${r.id}`} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <UserRound size={20} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 truncate text-sm font-medium text-slate-800">
                    {r.name}
                    {r.kind === 'user' && <Badge tone="brand">Uživatel</Badge>}
                    {r.role && <Badge tone="slate">{r.role}</Badge>}
                  </p>
                  <p className="truncate text-xs text-slate-500">{r.subtitle}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <CategoryMultiEdit
                    endpoint={
                      r.kind === 'person'
                        ? `/api/people/${r.id}/category`
                        : `/api/users/${r.id}/category`
                    }
                    categories={categories}
                    value={r.categoryIds}
                    disabled={!canManage}
                  />
                  {canManage && r.kind === 'person' && (
                    <>
                      <PersonPhotoEdit personId={r.id} hasPhoto={r.photoKey != null} />
                      <InlineEdit
                        action={updatePerson}
                        id={r.id}
                        fields={[
                          { name: 'name', label: 'Jméno', defaultValue: r.name },
                          { name: 'email', label: 'E-mail', type: 'email', defaultValue: r.person?.email ?? '' },
                          { name: 'phone', label: 'Telefon', defaultValue: r.person?.phone ?? '' },
                          { name: 'company', label: 'Firma', defaultValue: r.person?.company ?? '' },
                        ]}
                      />
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
