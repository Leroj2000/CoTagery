import Link from 'next/link';
import { notFound } from 'next/navigation';
import { apiBase } from '../../lib/session';

export const dynamic = 'force-dynamic';

interface CatalogItem {
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
}

function money(v: string, currency: string): string {
  const n = Number(v);
  return `${n.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} ${currency}`;
}

async function loadCatalog(tenant: string): Promise<CatalogItem[] | null> {
  const res = await fetch(`${apiBase()}/api/v1/public/rental/${encodeURIComponent(tenant)}`, {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return (await res.json()) as CatalogItem[];
}

export default async function RentalCatalog({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  const items = await loadCatalog(tenant);
  if (items === null) notFound();

  return (
    <main className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Půjčovna</h1>
          <p className="mt-1 text-sm text-slate-500">Položky k zapůjčení</p>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {items.length === 0 ? (
          <p className="text-slate-500">Zatím nejsou k dispozici žádné položky k zapůjčení.</p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((it) => (
              <Link
                key={it.listingId}
                href={`/pujcovna/${tenant}/${it.slug}`}
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
                  <h2 className="line-clamp-1 font-medium text-slate-900">{it.title}</h2>
                  {it.pickup && <p className="mt-0.5 text-xs text-slate-500">Vyzvednutí: {it.pickup}</p>}
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-lg font-semibold text-brand-700">
                      {money(it.pricePerDay, it.currency)}
                      <span className="text-xs font-normal text-slate-400"> / den</span>
                    </span>
                    {Number(it.depositAmount) > 0 && (
                      <span className="text-xs text-slate-400">
                        kauce {money(it.depositAmount, it.currency)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
