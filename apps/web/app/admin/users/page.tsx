import { apiFetch, ApiError } from '../../lib/server-api';
import type { AdminUser } from '../../lib/types';
import { ROLE_OPTIONS } from '../options';
import { Section, Badge, EmptyState } from '../ui';
import { ActionForm } from '../action-form';
import { inviteUser } from '../actions';
import { UserRowActions } from './user-row-actions';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  let users: AdminUser[] = [];
  let forbidden = false;
  try {
    users = await apiFetch<AdminUser[]>('/users');
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) forbidden = true;
    else throw e;
  }

  if (forbidden) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Uživatelé</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Na správu uživatelů potřebuješ roli ADMIN nebo vyšší.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Uživatelé</h1>
        <p className="text-sm text-neutral-500">Správa uživatelů tenanta a rolí (jen ADMIN+).</p>
      </div>

      <Section title="Pozvat uživatele">
        <ActionForm
          action={inviteUser}
          submitLabel="Pozvat"
          fields={[
            { name: 'email', label: 'E-mail', type: 'email', required: true },
            { name: 'name', label: 'Jméno', required: true },
            { name: 'tenantRole', label: 'Role', required: true, options: ROLE_OPTIONS },
          ]}
        />
      </Section>

      <Section title={`Uživatelé (${users.length})`}>
        {users.length === 0 ? (
          <EmptyState>Zatím žádní uživatelé.</EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {users.map((u) => (
              <li
                key={u.id}
                className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{u.name}</p>
                  <p className="truncate text-xs text-slate-500">{u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge>{u.tenantRole}</Badge>
                  <span className="text-xs text-slate-400">{u.status}</span>
                </div>
                <div className="shrink-0">
                  <UserRowActions userId={u.id} role={u.tenantRole} status={u.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
