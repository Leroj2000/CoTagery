import Link from 'next/link';
import { apiFetch, ApiError, getMe } from '../../lib/server-api';
import type { AdminUser } from '../../lib/types';
import { roleName, type RolesOverview } from '../../lib/roles';
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

  // Role firmy: názvy + které smím přidělit (hierarchie). Bez přístupu k rolím
  // zůstane výchozí seznam a hierarchii stejně ohlídá API.
  const [roles, me] = await Promise.all([
    apiFetch<RolesOverview>('/roles').catch(() => null),
    getMe().catch(() => null),
  ]);
  const roleOptions = roles
    ? roles.roles.filter((r) => r.assignable).map((r) => ({ value: r.key, label: r.name }))
    : ROLE_OPTIONS;
  const actorIsOwner = roles?.actor.roleKey === 'owner';
  const canChange = (u: AdminUser): boolean => {
    if (!roles?.actor.canManage || u.id === me?.user.id) return false;
    const target = roles.roles.find((r) => r.key === u.tenantRole.toLowerCase());
    return actorIsOwner || (!!target && target.rank < roles.actor.rank);
  };
  const label = (key: string): string => (roles ? roleName(roles.roles, key) : key);

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
        <p className="text-sm text-neutral-500">
          Přidělovat můžeš jen role pod svou úrovní. Co která role smí, nastavíš v{' '}
          <Link href="/admin/roles" className="font-medium text-brand-700 hover:underline">
            Role a oprávnění
          </Link>
          .
        </p>
      </div>

      <Section title="Pozvat uživatele">
        <ActionForm
          action={inviteUser}
          submitLabel="Pozvat"
          fields={[
            { name: 'email', label: 'E-mail', type: 'email', required: true },
            { name: 'name', label: 'Jméno', required: true },
            { name: 'tenantRole', label: 'Role', required: true, options: roleOptions },
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
                  <Badge>{label(u.tenantRole)}</Badge>
                  <span className="text-xs text-slate-400">{u.status}</span>
                </div>
                <div className="shrink-0">
                  <UserRowActions
                    userId={u.id}
                    role={u.tenantRole.toLowerCase()}
                    status={u.status}
                    options={roleOptions}
                    canChangeRole={canChange(u)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
