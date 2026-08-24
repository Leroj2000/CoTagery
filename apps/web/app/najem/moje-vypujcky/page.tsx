import Link from 'next/link';
import { redirect } from 'next/navigation';
import { apiBase } from '../../lib/session';
import { getRenter, getRenterToken } from '../../lib/renter-session';
import { RenterLogoutButton } from '../logout-button';

export const dynamic = 'force-dynamic';

interface RenterOrder {
  orderId: string;
  status: string;
  startsAt: string;
  endsAt: string;
  days: number;
  rentAmount: string;
  depositAmount: string;
  total: string;
  currency: string;
  listingTitle: string;
  listingSlug: string;
  assetName: string;
  tenantName: string;
  tenantSlug: string;
  pickup: string | null;
  createdAt: string;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  awaiting_payment: { label: 'Čeká na platbu', cls: 'bg-amber-50 text-amber-700' },
  paid: { label: 'Zaplaceno', cls: 'bg-emerald-50 text-emerald-700' },
  confirmed: { label: 'Potvrzeno', cls: 'bg-emerald-50 text-emerald-700' },
  picked_up: { label: 'Vyzvednuto', cls: 'bg-sky-50 text-sky-700' },
  returned: { label: 'Vráceno', cls: 'bg-slate-100 text-slate-600' },
  completed: { label: 'Dokončeno', cls: 'bg-slate-100 text-slate-600' },
  cancelled: { label: 'Zrušeno', cls: 'bg-red-50 text-red-600' },
  expired: { label: 'Vypršelo', cls: 'bg-red-50 text-red-600' },
};

function money(v: string, currency: string): string {
  return `${Number(v).toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} ${currency}`;
}

async function loadOrders(): Promise<RenterOrder[]> {
  const token = await getRenterToken();
  if (!token) return [];
  const res = await fetch(`${apiBase()}/api/v1/renter/orders`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return [];
  return (await res.json()) as RenterOrder[];
}

export default async function MyRentalsPage() {
  const renter = await getRenter();
  if (!renter) redirect('/najem/prihlaseni?next=/najem/moje-vypujcky');
  const orders = await loadOrders();

  return (
    <main className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-5">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Moje výpůjčky</h1>
            <p className="mt-0.5 text-sm text-slate-500">{renter.name} · {renter.email}</p>
          </div>
          <RenterLogoutButton />
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-8">
        {orders.length === 0 ? (
          <p className="text-sm text-slate-500">Zatím nemáš žádné výpůjčky.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {orders.map((o) => {
              const s = STATUS_LABEL[o.status] ?? { label: o.status, cls: 'bg-slate-100 text-slate-600' };
              return (
                <div key={o.orderId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/pujcovna/${o.tenantSlug}/${o.listingSlug}`}
                        className="font-medium text-slate-900 hover:underline"
                      >
                        {o.listingTitle}
                      </Link>
                      <p className="mt-0.5 text-xs text-slate-500">{o.tenantName}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.label}</span>
                  </div>
                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <div className="text-slate-600">
                      Termín:{' '}
                      <span className="font-medium text-slate-900">
                        {o.startsAt.slice(0, 10)} – {o.endsAt.slice(0, 10)} ({o.days} dní)
                      </span>
                    </div>
                    {o.pickup && (
                      <div className="text-slate-600">
                        Vyzvednutí: <span className="font-medium text-slate-900">{o.pickup}</span>
                      </div>
                    )}
                    <div className="text-slate-600">
                      Půjčovné: <span className="font-medium text-slate-900">{money(o.rentAmount, o.currency)}</span>
                    </div>
                    {Number(o.depositAmount) > 0 && (
                      <div className="text-slate-600">
                        Kauce: <span className="font-medium text-slate-900">{money(o.depositAmount, o.currency)}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="text-xs text-slate-400">Objednáno {o.createdAt.slice(0, 10)}</span>
                    <span className="text-base font-semibold text-slate-900">{money(o.total, o.currency)}</span>
                  </div>
                  {o.status === 'awaiting_payment' && (
                    <p className="mt-2 text-xs text-amber-600">
                      Pokyny k platbě (QR / převod) připravujeme – majitel tě bude kontaktovat.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
