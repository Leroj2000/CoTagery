import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { apiBase } from '../../../lib/session';

export const dynamic = 'force-dynamic';

interface ListingDetail {
  listingId: string;
  slug: string;
  title: string;
  description: string | null;
  terms: string | null;
  currency: string;
  pricePerDay: string;
  pricePerHour: string | null;
  pricePerWeek: string | null;
  depositAmount: string;
  minDays: number;
  maxDays: number | null;
  pickup: string | null;
  assetName: string;
  tenantName: string;
  photoCount: number;
}

function money(v: string | null, currency: string): string | null {
  if (v == null) return null;
  const n = Number(v);
  return `${n.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} ${currency}`;
}

async function loadListing(tenant: string, listing: string): Promise<ListingDetail | null> {
  const res = await fetch(
    `${apiBase()}/api/v1/public/rental/${encodeURIComponent(tenant)}/detail/${encodeURIComponent(listing)}`,
    { cache: 'no-store' },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as ListingDetail | null;
  return data && data.listingId ? data : null;
}

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ tenant: string; listing: string }>;
}) {
  const { tenant, listing } = await params;
  const l = await loadListing(tenant, listing);
  if (!l) notFound();

  const c = l.currency;
  const rows: [string, string | null][] = [
    ['Cena za den', money(l.pricePerDay, c)],
    ['Cena za hodinu', money(l.pricePerHour, c)],
    ['Cena za týden', money(l.pricePerWeek, c)],
    ['Kauce', Number(l.depositAmount) > 0 ? money(l.depositAmount, c) : '—'],
  ];
  const photos = Array.from({ length: l.photoCount }, (_, i) => i);

  return (
    <main className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-5">
          <Link href={`/pujcovna/${tenant}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
            <ArrowLeft size={15} /> Zpět na půjčovnu {l.tenantName}
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
            {photos.length > 0 ? (
              <img src={`/api/rental-photo/${l.listingId}/0`} alt={l.title} className="aspect-[4/3] w-full object-cover" />
            ) : (
              <div className="flex aspect-[4/3] w-full items-center justify-center text-slate-400">bez fotky</div>
            )}
          </div>
          {photos.length > 1 && (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {photos.slice(1).map((i) => (
                <img
                  key={i}
                  src={`/api/rental-photo/${l.listingId}/${i}`}
                  alt=""
                  className="aspect-square w-full rounded-lg border border-slate-200 object-cover"
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{l.title}</h1>
          {l.pickup && <p className="mt-1 text-sm text-slate-500">Místo vyzvednutí: {l.pickup}</p>}

          {l.description && <p className="mt-4 whitespace-pre-line text-sm text-slate-700">{l.description}</p>}

          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4">
            <table className="w-full text-sm">
              <tbody>
                {rows.filter(([, v]) => v != null).map(([k, v]) => (
                  <tr key={k} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 text-slate-500">{k}</td>
                    <td className="py-2 text-right font-medium text-slate-900">{v}</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-2 text-slate-500">Doba půjčení</td>
                  <td className="py-2 text-right font-medium text-slate-900">
                    {l.minDays}–{l.maxDays ?? '∞'} dní
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <button
            disabled
            className="mt-4 w-full cursor-not-allowed rounded-xl bg-slate-200 px-4 py-3 text-sm font-semibold text-slate-500"
          >
            Rezervace a objednávka — připravujeme
          </button>

          {l.terms && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-slate-700">Podmínky zapůjčení</h3>
              <p className="mt-1 whitespace-pre-line text-xs text-slate-500">{l.terms}</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
