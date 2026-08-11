import { apiFetch } from '../../lib/server-api';
import type { MembershipTier, Member } from '../../lib/types';
import { Section, Table, Badge } from '../ui';
import { ActionForm } from '../action-form';
import { createTier, createMember, issueMembership } from '../actions';

export const dynamic = 'force-dynamic';

export default async function MembershipPage() {
  const [tiers, members] = await Promise.all([
    apiFetch<MembershipTier[]>('/memberships/tiers'),
    apiFetch<Member[]>('/memberships/members'),
  ]);

  const tierOptions = tiers.map((t) => ({ value: t.id, label: t.name }));
  const memberOptions = members.map((m) => ({ value: m.id, label: `${m.name} (${m.email ?? '—'})` }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Členství</h1>
        <p className="text-sm text-neutral-500">Tiery, členové a vydaná členství.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Nový tier">
          <ActionForm
            action={createTier}
            submitLabel="Vytvořit tier"
            fields={[
              { name: 'name', label: 'Název', required: true, placeholder: 'VIP' },
              { name: 'level', label: 'Úroveň', type: 'number', placeholder: '10' },
              { name: 'price', label: 'Cena', placeholder: '1000' },
              { name: 'validityDays', label: 'Platnost (dní)', type: 'number', placeholder: '365' },
              { name: 'graceDays', label: 'Grace (dní)', type: 'number', placeholder: '7' },
              { name: 'zoneKeys', label: 'Zóny (čárkou)', placeholder: 'vip, spa' },
            ]}
          />
        </Section>

        <Section title="Nový člen">
          <ActionForm
            action={createMember}
            submitLabel="Vytvořit člena"
            fields={[
              { name: 'name', label: 'Jméno', required: true },
              { name: 'email', label: 'E-mail', type: 'email' },
            ]}
          />
        </Section>
      </div>

      <Section title="Vydat členství">
        {tiers.length === 0 || members.length === 0 ? (
          <p className="text-sm text-neutral-400">Nejdřív vytvoř tier a člena.</p>
        ) : (
          <ActionForm
            action={issueMembership}
            submitLabel="Vydat členství"
            fields={[
              { name: 'memberId', label: 'Člen', required: true, options: memberOptions },
              { name: 'tierId', label: 'Tier', required: true, options: tierOptions },
            ]}
          />
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={`Tiery (${tiers.length})`}>
          <Table
            head={['Název', 'Úroveň', 'Cena', 'Platnost', 'Zóny']}
            rows={tiers.map((t) => [
              t.name,
              t.level,
              `${t.price} ${t.currency}`,
              `${t.validityDays} d`,
              t.zoneKeys.length ? t.zoneKeys.map((z) => <Badge key={z}>{z}</Badge>) : '—',
            ])}
          />
        </Section>

        <Section title={`Členové (${members.length})`}>
          <Table
            head={['Jméno', 'E-mail']}
            rows={members.map((m) => [m.name, m.email ?? '—'])}
          />
        </Section>
      </div>
    </div>
  );
}
