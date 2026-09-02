import Link from 'next/link';
import { apiBase } from '../lib/session';

export const dynamic = 'force-dynamic';

interface FeedItem {
  listingId: string;
  slug: string;
  title: string;
  currency: string;
  pricePerDay: string;
  assetName: string;
  photoCount: number;
  tenantName: string;
  tenantSlug: string | null;
}

function money(v: string, currency: string): string {
  return `${Number(v).toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} ${currency}`;
}

async function loadDiscover(q: string): Promise<FeedItem[]> {
  const res = await fetch(
    `${apiBase()}/api/v1/network/discover?q=${encodeURIComponent(q)}&limit=48`,
    { cache: 'no-store' },
  );
  if (!res.ok) return [];
  return (await res.json()) as FeedItem[];
}

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = '' } = await searchParams;
  const items = await loadDiscover(q);

  return (
    <main className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Objevit půjčovny</h1>
          <p className="mt-1 text-sm text-slate-500">
            Prohledej nabídku firem zapojených v síti.
          </p>
          <form action="/pujcovna" method="get" className="mt-4 flex gap-2">
            <input
              name="q"
              defaultValue={q}
              placeholder="Hledat položku, kategorii, firmu nebo místo…"
              className="w-full max-w-lg rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10"
            />
            <button
              type="submit"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700"
            >
              Hledat
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">
            {q ? `Pro „${q}" nic nenalezeno.` : 'Zatím žádné nabídky v síti.'}
          </p>
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
