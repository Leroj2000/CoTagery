import Link from 'next/link';
import { redirect } from 'next/navigation';
import { apiBase } from '../lib/session';
import { getRenter, getRenterToken } from '../lib/renter-session';

export const dynamic = 'force-dynamic';

/** Položka feedu sítě (publikovaný inzerát sledované firmy). */
interface FeedItem {
  listingId: string;
  slug: string;
  title: string;
  description: string | null;
  currency: string;
  pricePerDay: string;
  depositAmount: string;
  pickup: string | null;
  assetName: string;
  photoCount: number;
  tenantId: string;
  tenantName: string;
  tenantSlug: string | null;
  publishedAt: string | null;
}

function money(v: string, currency: string): string {
  return `${Number(v).toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} ${currency}`;
}

async function loadFeed(): Promise<FeedItem[]> {
  const token = await getRenterToken();
  if (!token) return [];
  const res = await fetch(`${apiBase()}/api/v1/network/feed?limit=40`, {
    headers: { authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) return [];
  return (await res.json()) as FeedItem[];
}

export default async function SitPage() {
  const renter = await getRenter();
  if (!renter) redirect('/najem/prihlaseni?next=/sit');
  const items = await loadFeed();

  return (
    <main className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Síť</h1>
            <p className="mt-1 text-sm text-slate-500">
              Novinky z půjčoven, které sleduješ · {renter.name}
            </p>
          </div>
          <Link
            href="/najem/moje-vypujcky"
            className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Moje výpůjčky
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <p className="text-sm font-medium text-slate-600">Ve feedu zatím nic není</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-slate-400">
              Až začneš sledovat půjčovny, jejich nabídka se objeví tady. Sledování firem přímo
              z jejich stránky připravujeme.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((it) => (
              <Link
                key={it.listingId}
                href={`/pujcovna/${it.tenantSlug}/${it.slug}`}
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100">
                  {it.photoCount > 0 ? (
                    <img
                      src={`/api/rental-photo/${it.listingId}/0`}
                      alt={it.title}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
                      bez fotky
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-brand-600">
                    {it.tenantName}
                  </p>
                  <h2 className="mt-0.5 truncate text-base font-semibold text-slate-900">
                    {it.title}
                  </h2>
                  <p className="mt-0.5 truncate text-sm text-slate-500">{it.assetName}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {money(it.pricePerDay, it.currency)}{' '}
                    <span className="font-normal text-slate-400">/ den</span>
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
