import { apiFetch, ApiError, getMyPermissions } from '../../lib/server-api';
import type { Group, GroupMember, AdminUser, Person } from '../../lib/types';
import { Section, Table, Mono } from '../ui';
import { ActionForm } from '../action-form';
import { ActionButton } from '../action-button';
import { createGroup, deleteGroup, addGroupMember, removeGroupMember } from '../actions';

export const dynamic = 'force-dynamic';

export default async function GroupsPage() {
  const [groups, perms] = await Promise.all([apiFetch<Group[]>('/groups'), getMyPermissions()]);
  const canManageUsers = perms.has('core.group.manage');
  const canManagePersons = perms.has('core.person_group.manage');

  let users: AdminUser[] = [];
  try {
    users = await apiFetch<AdminUser[]>('/users');
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 403)) throw e;
  }
  const userById = new Map(users.map((u) => [u.id, u]));
  const userOptions = users.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }));

  let people: Person[] = [];
  try {
    people = await apiFetch<Person[]>('/people');
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 403)) throw e;
  }
  const personById = new Map(people.map((p) => [p.id, p]));
  const personOptions = people.map((p) => ({
    value: p.id,
    label: p.email ? `${p.name} (${p.email})` : p.name,
  }));

  const membersByGroup = await Promise.all(
    groups.map((g) => apiFetch<GroupMember[]>(`/groups/${g.id}/members`).catch(() => [])),
  );

  // Volby typu skupiny nabídni jen podle oprávnění volajícího.
  const typeOptions = [
    ...(canManageUsers ? [{ value: 'user', label: 'Uživatelé' }] : []),
    ...(canManagePersons ? [{ value: 'person', label: 'Osoby' }] : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Skupiny</h1>
        <p className="text-sm text-neutral-500">
          Skupiny uživatelů (jen ADMIN+) nebo osob z „Lidí“ (ADMIN+ i editor).
        </p>
      </div>

      {typeOptions.length > 0 ? (
        <Section title="Nová skupina">
          <ActionForm
            action={createGroup}
            submitLabel="Vytvořit skupinu"
            fields={[
              { name: 'name', label: 'Název', required: true, placeholder: 'Zaměstnanci' },
              {
                name: 'type',
                label: 'Typ',
                required: true,
                options: typeOptions,
                defaultValue: typeOptions[0].value,
              },
            ]}
          />
        </Section>
      ) : (
        <p className="text-sm text-neutral-400">Nemáte oprávnění zakládat skupiny.</p>
      )}

      {groups.length === 0 && <p className="text-sm text-neutral-400">Zatím žádné skupiny.</p>}

      {groups.map((g, i) => {
        const isPerson = g.type === 'person';
        const canManage = isPerson ? canManagePersons : canManageUsers;
        const options = isPerson ? personOptions : userOptions;
        return (
          <Section
            key={g.id}
            title={
              <span className="inline-flex items-center gap-2">
                {g.name}
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    isPerson
                      ? 'bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-100'
                      : 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-100'
                  }`}
                >
                  {isPerson ? 'Osoby' : 'Uživatelé'}
                </span>
              </span>
            }
            action={
              canManage ? (
                <ActionButton
                  action={deleteGroup}
                  hidden={{ groupId: g.id }}
                  label="Smazat skupinu"
                  variant="danger"
                  confirm={`Smazat skupinu ${g.name}?`}
                />
              ) : undefined
            }
          >
            <div className="flex flex-col gap-4">
              <Table
                head={[isPerson ? 'Osoba' : 'Uživatel', 'Akce']}
                rows={membersByGroup[i].map((m) => {
                  const ref = isPerson ? m.personId : m.userId;
                  const label = isPerson
                    ? personById.get(m.personId ?? '')?.name
                    : userById.get(m.userId ?? '')?.name;
                  return [
                    label ?? <Mono key="ref">{(ref ?? '').slice(0, 8)}…</Mono>,
                    canManage && ref ? (
                      <ActionButton
                        key="rm"
                        action={removeGroupMember}
                        hidden={{ groupId: g.id, memberRef: ref }}
                        label="Odebrat"
                        variant="danger"
                      />
                    ) : (
                      <span key="rm" className="text-xs text-neutral-400">
                        —
                      </span>
                    ),
                  ];
                })}
              />
              {canManage && options.length > 0 && (
                <ActionForm
                  action={addGroupMember}
                  hidden={{ groupId: g.id }}
                  submitLabel="Přidat člena"
                  fields={[
                    {
                      name: isPerson ? 'personId' : 'userId',
                      label: isPerson ? 'Osoba' : 'Uživatel',
                      required: true,
                      options,
                    },
                  ]}
                />
              )}
            </div>
          </Section>
        );
      })}
    </div>
  );
}
