import { apiFetch } from '../../lib/server-api';
import type {
  MembershipTier,
  Member,
  Membership,
  DataCarrier,
  MembershipBenefit,
} from '../../lib/types';
import { BENEFIT_KIND_OPTIONS } from '../options';
import { Section, Table, Badge } from '../ui';
import { ActionForm } from '../action-form';
import { createTier, createMember, issueMembership, issueCard, addBenefit } from '../actions';

export const dynamic = 'force-dynamic';

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('cs-CZ');
}

export default async function MembershipPage() {
  const [tiers, members, memberships, unassigned] = await Promise.all([
    apiFetch<MembershipTier[]>('/memberships/tiers'),
    apiFetch<Member[]>('/memberships/members'),
    apiFetch<Membership[]>('/memberships'),
    apiFetch<DataCarrier[]>('/carriers/unassigned'),
  ]);

  const benefitsByTier = await Promise.all(
    tiers.map((t) => apiFetch<MembershipBenefit[]>(`/memberships/tiers/${t.id}/benefits`)),
  );
  const allBenefits = tiers.flatMap((t, i) =>
    benefitsByTier[i].map((b) => ({ tierName: t.name, ...b })),
  );

  const tierById = new Map(tiers.map((t) => [t.id, t]));
  const memberById = new Map(members.map((m) => [m.id, m]));

  const tierOptions = tiers.map((t) => ({ value: t.id, label: t.name }));
  const memberOptions = members.map((m) => ({ value: m.id, label: `${m.name} (${m.email ?? '—'})` }));
  const membershipOptions = memberships.map((ms) => ({
    value: ms.id,
    label: `${memberById.get(ms.memberId)?.name ?? '—'} · ${tierById.get(ms.tierId)?.name ?? '—'}`,
  }));
  const carrierOptions = unassigned.map((c) => ({ value: c.id, label: c.publicCode }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Členství</h1>
        <p className="text-sm text-neutral-500">Tiery, členové, členství a karty.</p>
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

      <div className="grid gap-6 lg:grid-cols-2">
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

        <Section title="Vydat kartu (na identifikátor)">
          {memberships.length === 0 || unassigned.length === 0 ? (
            <p className="text-sm text-neutral-400">
              Potřebuješ vydané členství a nepřiřazený identifikátor (viz Identifikátory).
            </p>
          ) : (
            <ActionForm
              action={issueCard}
              submitLabel="Vydat kartu"
              fields={[
                { name: 'membershipId', label: 'Členství', required: true, options: membershipOptions },
                { name: 'dataCarrierId', label: 'Identifikátor', required: true, options: carrierOptions },
              ]}
            />
          )}
        </Section>
      </div>

      <Section title={`Členství (${memberships.length})`}>
        <Table
          head={['Člen', 'Tier', 'Stav', 'Platí do']}
          rows={memberships.map((ms) => [
            memberById.get(ms.memberId)?.name ?? '—',
            tierById.get(ms.tierId)?.name ?? '—',
            <Badge key="s">{ms.status}</Badge>,
            fmtDate(ms.validTo),
          ])}
        />
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title={`Tiery (${tiers.length})`}>
          <Table
            head={['Název', 'Úroveň', 'Cena', 'Zóny']}
            rows={tiers.map((t) => [
              t.name,
              t.level,
              `${t.price} ${t.currency}`,
              t.zoneKeys.length ? t.zoneKeys.map((z) => <Badge key={z}>{z}</Badge>) : '—',
            ])}
          />
        </Section>

        <Section title={`Členové (${members.length})`}>
          <Table head={['Jméno', 'E-mail']} rows={members.map((m) => [m.name, m.email ?? '—'])} />
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Přidat benefit tieru">
          {tiers.length === 0 ? (
            <p className="text-sm text-neutral-400">Nejdřív vytvoř tier.</p>
          ) : (
            <ActionForm
              action={addBenefit}
              submitLabel="Přidat benefit"
              fields={[
                { name: 'tierId', label: 'Tier', required: true, options: tierOptions },
                { name: 'kind', label: 'Typ', required: true, options: BENEFIT_KIND_OPTIONS },
                { name: 'value', label: 'Hodnota (%/cena)', placeholder: '20' },
                { name: 'targetKey', label: 'Cíl (SKU/zóna)', placeholder: 'volitelně' },
                { name: 'description', label: 'Popis', placeholder: 'volitelně' },
              ]}
            />
          )}
        </Section>

        <Section title={`Benefity (${allBenefits.length})`}>
          <Table
            head={['Tier', 'Typ', 'Hodnota', 'Cíl']}
            rows={allBenefits.map((b) => [
              b.tierName,
              <Badge key="k">{b.kind}</Badge>,
              b.value ?? '—',
              b.targetKey ?? '—',
            ])}
          />
        </Section>
      </div>
    </div>
  );
}
