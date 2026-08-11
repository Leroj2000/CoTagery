import { apiFetch, ApiError } from '../../lib/server-api';
import type { Group, GroupMember, AdminUser } from '../../lib/types';
import { Section, Table, Mono } from '../ui';
import { ActionForm } from '../action-form';
import { ActionButton } from '../action-button';
import { createGroup, deleteGroup, addGroupMember, removeGroupMember } from '../actions';

export const dynamic = 'force-dynamic';

export default async function GroupsPage() {
  const groups = await apiFetch<Group[]>('/groups');

  let users: AdminUser[] = [];
  try {
    users = await apiFetch<AdminUser[]>('/users');
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 403)) throw e;
  }
  const userById = new Map(users.map((u) => [u.id, u]));
  const userOptions = users.map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }));

  const membersByGroup = await Promise.all(
    groups.map((g) => apiFetch<GroupMember[]>(`/groups/${g.id}/members`).catch(() => [])),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Skupiny</h1>
        <p className="text-sm text-neutral-500">Skupiny uživatelů tenanta (jen ADMIN+ pro změny).</p>
      </div>

      <Section title="Nová skupina">
        <ActionForm
          action={createGroup}
          submitLabel="Vytvořit skupinu"
          fields={[{ name: 'name', label: 'Název', required: true, placeholder: 'Zaměstnanci' }]}
        />
      </Section>

      {groups.length === 0 && <p className="text-sm text-neutral-400">Zatím žádné skupiny.</p>}

      {groups.map((g, i) => (
        <Section
          key={g.id}
          title={g.name}
          action={
            <ActionButton
              action={deleteGroup}
              hidden={{ groupId: g.id }}
              label="Smazat skupinu"
              variant="danger"
              confirm={`Smazat skupinu ${g.name}?`}
            />
          }
        >
          <div className="flex flex-col gap-4">
            <Table
              head={['Uživatel', 'Akce']}
              rows={membersByGroup[i].map((m) => [
                userById.get(m.userId)?.name ?? <Mono key="u">{m.userId.slice(0, 8)}…</Mono>,
                <ActionButton
                  key="rm"
                  action={removeGroupMember}
                  hidden={{ groupId: g.id, userId: m.userId }}
                  label="Odebrat"
                  variant="danger"
                />,
              ])}
            />
            {userOptions.length > 0 && (
              <ActionForm
                action={addGroupMember}
                hidden={{ groupId: g.id }}
                submitLabel="Přidat člena"
                fields={[{ name: 'userId', label: 'Uživatel', required: true, options: userOptions }]}
              />
            )}
          </div>
        </Section>
      ))}
    </div>
  );
}
