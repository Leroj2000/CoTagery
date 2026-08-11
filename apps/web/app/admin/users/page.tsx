import { apiFetch, ApiError } from '../../lib/server-api';
import type { AdminUser } from '../../lib/types';
import { ROLE_OPTIONS } from '../options';
import { Section, Table, Badge } from '../ui';
import { ActionForm } from '../action-form';
import { inviteUser } from '../actions';

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
        <Table
          head={['Jméno', 'E-mail', 'Role', 'Stav']}
          rows={users.map((u) => [
            u.name,
            u.email,
            <Badge key="r">{u.tenantRole}</Badge>,
            u.status,
          ])}
        />
      </Section>
    </div>
  );
}
