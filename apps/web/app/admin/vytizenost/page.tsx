import Link from 'next/link';
import { Gauge } from 'lucide-react';
import { apiFetch } from '../../lib/server-api';
import { PageHeader, Section, Table, Badge, EmptyState, type BadgeTone } from '../ui';

export const dynamic = 'force-dynamic';

type Verdict = 'overused' | 'idle' | 'ok' | 'new';

interface AssetUtilization {
  assetId: string;
  assetName: string;
  category: string | null;
  daysTracked: number;
  daysInUse: number;
  daysInService: number;
  utilizationPct: number;
  movementsInWindow: number;
  lastMovementAt: string | null;
  daysSinceMovement: number;
  verdict: Verdict;
}

interface UtilizationReport {
  days: number;
  assets: AssetUtilization[];
  categories: {
    category: string;
    assets: number;
    avgUtilizationPct: number;
    overused: number;
    idle: number;
  }[];
  totals: Record<Verdict, number>;
}

const VERDICT: Record<Verdict, { label: string; tone: BadgeTone }> = {
  overused: { label: 'Přetížené – zvaž dokoupení', tone: 'red' },
  idle: { label: 'Ležák – zvaž prodej', tone: 'amber' },
  ok: { label: 'V pořádku', tone: 'green' },
  new: { label: 'Nová (málo dat)', tone: 'slate' },
};

const PERIODS = [30, 90, 180, 365];

/** Report vytíženosti (BACKLOG ZAK-03) – podle knihy pohybů, bez zakázek. */
export default async function UtilizationPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days: raw } = await searchParams;
  const days = PERIODS.includes(Number(raw)) ? Number(raw) : 90;
  const report = await apiFetch<UtilizationReport>(`/reports/utilization?days=${days}`);
  const assetRow = (a: AssetUtilization) => [
    <Link
      key="n"
      href={`/admin/assets/${a.assetId}`}
      className="font-medium text-brand-700 hover:underline"
    >
      {a.assetName}
    </Link>,
    a.category ?? '—',
    `${a.utilizationPct} %`,
    `${a.daysInUse} / ${a.daysTracked} dní`,
    a.daysSinceMovement === 0 ? 'dnes' : `před ${a.daysSinceMovement} dny`,
    <Badge key="v" tone={VERDICT[a.verdict].tone}>
      {VERDICT[a.verdict].label}
    </Badge>,
  ];
  const head = ['Položka', 'Kategorie', 'Vytíženost', 'V použití', 'Poslední pohyb', 'Doporučení'];
  const overused = report.assets.filter((a) => a.verdict === 'overused');
  const idle = report.assets.filter((a) => a.verdict === 'idle');

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Vytíženost"
        description={`Za posledních ${days} dní: v použití = u osoby nebo mimo domovské místo. ${report.totals.overused} přetížených, ${report.totals.idle} ležáků.`}
        icon={<Gauge size={18} />}
      />
      <div className="flex gap-2 text-sm">
        {PERIODS.map((p) => (
          <Link
            key={p}
            href={`/admin/vytizenost?days=${p}`}
            className={`rounded-lg border px-3 py-1 ${p === days ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
          >
            {p} dní
          </Link>
        ))}
      </div>

      <Section title="Podle kategorií" description="Průměrná vytíženost (bez nových položek)">
        {report.categories.length === 0 ? (
          <EmptyState>Žádné položky.</EmptyState>
        ) : (
          <Table
            head={['Kategorie', 'Položek', 'Průměr', 'Přetížené', 'Ležáky']}
            rows={report.categories.map((c) => [
              c.category,
              String(c.assets),
              `${c.avgUtilizationPct} %`,
              String(c.overused),
              String(c.idle),
            ])}
          />
        )}
      </Section>

      <Section
        title="Přetížené"
        description="V použití ≥ 80 % času – kandidáti na dokoupení"
        action={<Badge tone="red">{overused.length}</Badge>}
      >
        {overused.length === 0 ? (
          <EmptyState>Nic přetíženého.</EmptyState>
        ) : (
          <Table head={head} rows={overused.map(assetRow)} />
        )}
      </Section>

      <Section
        title="Ležáky"
        description="Pod 5 % a bez pohybu 60+ dní – kandidáti na prodej nebo přesun"
        action={<Badge tone="amber">{idle.length}</Badge>}
      >
        {idle.length === 0 ? (
          <EmptyState>Žádné ležáky.</EmptyState>
        ) : (
          <Table head={head} rows={idle.map(assetRow)} />
        )}
      </Section>

      <Section title="Všechny položky" description="Seřazeno podle vytíženosti">
        {report.assets.length === 0 ? (
          <EmptyState>Žádné položky.</EmptyState>
        ) : (
          <Table head={head} rows={report.assets.map(assetRow)} />
        )}
      </Section>
    </div>
  );
}
