import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiFetch, ApiError } from '../../../lib/server-api';
import type { Subscription, Invoice } from '../../../lib/types';
import { Section, Table, Badge, Mono } from '../../ui';
import { ActionButton } from '../../action-button';
import { cancelSubscription } from '../../actions';

export const dynamic = 'force-dynamic';

function fmtDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('cs-CZ') : '—';
}

export default async function SubscriptionDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let sub: Subscription;
  try {
    sub = await apiFetch<Subscription>(`/billing/subscriptions/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const [invoices, portal] = await Promise.all([
    apiFetch<Invoice[]>(`/billing/subscriptions/${id}/invoices`),
    apiFetch<{ url: string }>(`/billing/subscriptions/${id}/portal`).catch(() => ({ url: '' })),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/admin/billing" className="text-xs text-neutral-500 hover:underline">
            ← Předplatná
          </Link>
          <h1 className="mt-1 text-xl font-semibold">Předplatné</h1>
          <p className="text-sm text-neutral-500">
            <Badge>{sub.status}</Badge> · konec období {fmtDate(sub.currentPeriodEnd)} ·{' '}
            <Mono>{sub.pspSubscriptionRef}</Mono>
          </p>
        </div>
        {sub.status !== 'canceled' && (
          <ActionButton
            action={cancelSubscription}
            hidden={{ subscriptionId: sub.id, immediately: 'false' }}
            label="Zrušit (konec období)"
            variant="danger"
            confirm="Zrušit předplatné na konci období?"
          />
        )}
      </div>

      {portal.url && (
        <p className="text-sm">
          PSP portál:{' '}
          <a href={portal.url} className="text-blue-600 hover:underline" target="_blank" rel="noreferrer">
            {portal.url}
          </a>
        </p>
      )}

      <Section title={`Faktury (${invoices.length})`}>
        <Table
          head={['Ref', 'Netto', 'DPH', 'Reverse charge', 'Stav', 'Období do']}
          rows={invoices.map((inv) => [
            <Mono key="r">{inv.pspInvoiceRef}</Mono>,
            `${inv.amountNet} ${inv.currency}`,
            `${inv.vatAmount} (${inv.vatRate}%)`,
            inv.reverseCharge ? 'ano' : 'ne',
            <Badge key="s">{inv.status}</Badge>,
            fmtDate(inv.periodEnd),
          ])}
        />
      </Section>
    </div>
  );
}
