import Link from 'next/link';
import { Bell, Clock, Wrench } from 'lucide-react';
import { apiFetch } from '../../lib/server-api';
import type { Attention, Person, Location } from '../../lib/types';
import { PageHeader, Section, Table, Badge, EmptyState } from '../ui';
import { ActionButton } from '../action-button';
import { confirmMovement, resolveIssue } from '../actions';

export const dynamic = 'force-dynamic';

const ISSUE_LABELS: Record<string, string> = {
  damage: 'Poškození',
  malfunction: 'Závada',
  missing_part: 'Chybí díl',
  other: 'Jiné',
};

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('cs-CZ') : '—';
}

export default async function AttentionPage() {
  const [att, people, locations] = await Promise.all([
    apiFetch<Attention>('/assets/attention'),
    apiFetch<Person[]>('/people'),
    apiFetch<Location[]>('/locations'),
  ]);
  const personName = new Map(people.map((p) => [p.id, p.name]));
  const locName = new Map(locations.map((l) => [l.id, l.name]));
  const holderLabel = (t: string | null, id: string | null): string =>
    !id ? '—' : t === 'person' ? (personName.get(id) ?? '—') : (locName.get(id) ?? '—');

  const total =
    att.overdue.length + att.pendingConfirmations.length + att.openIssues.length + att.dueServices.length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Vyžaduje pozornost"
        description={total === 0 ? 'Vše v pořádku 🎉' : `${total} položek k vyřešení`}
        icon={<Bell size={18} />}
      />

      <Section
        title="Po termínu"
        description="Položky, které měly být vrácené"
        action={<Badge tone="red">{att.overdue.length}</Badge>}
      >
        {att.overdue.length === 0 ? (
          <EmptyState>Nic po termínu.</EmptyState>
        ) : (
          <Table
            head={['Položka', 'Má ji', 'Vrátit do']}
            rows={att.overdue.map((a) => [
              <Link key="n" href={`/admin/assets/${a.id}`} className="font-medium text-brand-700 hover:underline">
                {a.name}
              </Link>,
              holderLabel(a.currentHolderType, a.currentHolderId),
              <span key="d" className="inline-flex items-center gap-1 text-red-600">
                <Clock size={13} /> {fmtDate(a.dueAt)}
              </span>,
            ])}
          />
        )}
      </Section>

      <Section
        title="Nepotvrzená předání"
        description="Čekají na potvrzení převzetí"
        action={<Badge tone="amber">{att.pendingConfirmations.length}</Badge>}
      >
        {att.pendingConfirmations.length === 0 ? (
          <EmptyState>Vše potvrzeno.</EmptyState>
        ) : (
          <Table
            head={['Kdy', 'Komu', 'Akce']}
            rows={att.pendingConfirmations.map((m) => [
              fmtDate(m.createdAt),
              holderLabel(m.toType, m.toId),
              <ActionButton
                key="c"
                action={confirmMovement}
                hidden={{ movementId: m.id, assetId: m.assetId ?? '' }}
                label="Potvrdit"
              />,
            ])}
          />
        )}
      </Section>

      <Section
        title="Nahlášené problémy"
        description="Otevřená hlášení poškození / závad"
        action={<Badge tone="red">{att.openIssues.length}</Badge>}
      >
        {att.openIssues.length === 0 ? (
          <EmptyState>Žádné otevřené problémy.</EmptyState>
        ) : (
          <Table
            head={['Položka', 'Typ', 'Popis', 'Akce']}
            rows={att.openIssues.map((i) => [
              <Link key="n" href={`/admin/assets/${i.assetId}`} className="font-medium text-brand-700 hover:underline">
                zobrazit
              </Link>,
              <Badge key="k" tone="red">{ISSUE_LABELS[i.kind] ?? i.kind}</Badge>,
              i.description,
              <ActionButton
                key="r"
                action={resolveIssue}
                hidden={{ issueId: i.id, assetId: i.assetId }}
                label="Vyřešit"
              />,
            ])}
          />
        )}
      </Section>

      <Section
        title="Blížící se servis / revize"
        description="Do 30 dní"
        action={<Badge tone="amber">{att.dueServices.length}</Badge>}
      >
        {att.dueServices.length === 0 ? (
          <EmptyState>Žádný blížící se servis.</EmptyState>
        ) : (
          <Table
            head={['Typ', 'Termín', 'Kdo']}
            rows={att.dueServices.map((s) => [
              <span key="k" className="inline-flex items-center gap-1">
                <Wrench size={13} className="text-slate-400" /> {s.kind}
              </span>,
              fmtDate(s.nextDueAt),
              s.provider ?? '—',
            ])}
          />
        )}
      </Section>
    </div>
  );
}
