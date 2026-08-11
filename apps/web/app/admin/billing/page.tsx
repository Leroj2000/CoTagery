import { apiFetch } from '../../lib/server-api';
import type { Subscription, UsageMeter, MembershipTier, Member } from '../../lib/types';
import { Section, Table, Badge, Mono } from '../ui';
import { ActionForm } from '../action-form';
import { checkout } from '../actions';

export const dynamic = 'force-dynamic';

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('cs-CZ') : '—';
}

export default async function BillingPage() {
  const [subs, usage, tiers, members] = await Promise.all([
    apiFetch<Subscription[]>('/billing/subscriptions'),
    apiFetch<UsageMeter[]>('/billing/usage'),
    apiFetch<MembershipTier[]>('/memberships/tiers'),
    apiFetch<Member[]>('/memberships/members'),
  ]);

  const tierOptions = tiers.map((t) => ({ value: t.id, label: t.name }));
  const memberOptions = members.map((m) => ({ value: m.id, label: `${m.name} (${m.email ?? '—'})` }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Předplatné</h1>
        <p className="text-sm text-neutral-500">Předplatná, faktury a metering (stub PSP).</p>
      </div>

      <Section title="Nové předplatné (checkout)">
        {tiers.length === 0 || members.length === 0 ? (
          <p className="text-sm text-neutral-400">Nejdřív vytvoř tier a člena v sekci Členství.</p>
        ) : (
          <ActionForm
            action={checkout}
            submitLabel="Založit předplatné"
            fields={[
              { name: 'memberId', label: 'Člen', required: true, options: memberOptions },
              { name: 'tierId', label: 'Tier', required: true, options: tierOptions },
              { name: 'trialDays', label: 'Trial (dní)', type: 'number', placeholder: '0' },
            ]}
          />
        )}
      </Section>

      <Section title={`Předplatná (${subs.length})`}>
        <Table
          head={['Stav', 'Konec období', 'PSP ref']}
          rows={subs.map((s) => [
            <Badge key="st">{s.status}</Badge>,
            fmtDate(s.currentPeriodEnd),
            <Mono key="r">{s.pspSubscriptionRef}</Mono>,
          ])}
        />
      </Section>

      <Section title="Metering (Tok 2 – vydané karty)">
        <Table
          head={['Období', 'Metrika', 'Množství', 'Nareportováno']}
          rows={usage.map((u) => [u.period, u.metric, u.quantity, fmtDate(u.reportedAt)])}
        />
      </Section>
    </div>
  );
}
