'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchScan, type ScanResult, type MembershipCardScan } from '../../lib/api';

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  active: { label: 'Aktivní', cls: 'bg-green-100 text-green-800' },
  expired: { label: 'Vypršelo', cls: 'bg-red-100 text-red-800' },
  suspended: { label: 'Pozastaveno', cls: 'bg-amber-100 text-amber-800' },
  cancelled: { label: 'Zrušeno', cls: 'bg-neutral-200 text-neutral-700' },
};

const BENEFIT_LABELS: Record<string, string> = {
  discount_percent: 'Sleva',
  special_price: 'Speciální cena',
  free: 'Zdarma',
  zone_access: 'Vstup do zóny',
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('cs-CZ');
}

/** Veřejný pohled po skenu kódu (mobile-first). Rozliší modul podle odpovědi. */
export default function ScanPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [state, setState] = useState<{ status: number; body: ScanResult } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchScan(code)
      .then(setState)
      .catch((err: unknown) => setError(String(err)));
  }, [code]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <header className="pt-8">
        <h1 className="text-2xl font-semibold">Tagery</h1>
        <p className="text-sm text-neutral-500">
          Kód <span className="font-mono">{code}</span>
        </p>
      </header>

      {error && <p className="text-sm text-red-600">Chyba: {error}</p>}
      {!error && !state && <p className="text-sm text-neutral-400">Načítám…</p>}

      {state && <ScanBody code={code} status={state.status} body={state.body} />}
    </main>
  );
}

function ScanBody({ code, status, body }: { code: string; status: number; body: ScanResult }) {
  if (status === 404) return <Card>Neznámý kód.</Card>;
  if (status === 410) return <Card>Kód není aktivní nebo vypršel.</Card>;

  if ('status' in body && body.status === 'unassigned') {
    return (
      <Card>
        <p className="mb-4 text-sm text-neutral-600">Tento kód zatím není přiřazený.</p>
        <Link
          href={`/activate/${code}`}
          className="inline-block rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
        >
          Aktivovat kód
        </Link>
      </Card>
    );
  }

  if ('type' in body && body.type === 'membership') {
    return <MembershipCard card={(body as MembershipCardScan).card} />;
  }

  if ('type' in body && body.type === 'product') {
    const p = (body as { product: Record<string, string | null> | null }).product;
    return (
      <Card>
        <h2 className="mb-2 text-lg font-semibold">{p?.name ?? 'Produkt'}</h2>
        {p?.brand && <p className="text-sm text-neutral-500">{p.brand}</p>}
        {p?.description && <p className="mt-2 text-sm">{p.description}</p>}
      </Card>
    );
  }

  return (
    <Card>
      <pre className="overflow-x-auto text-xs text-neutral-600">
        {JSON.stringify(body, null, 2)}
      </pre>
    </Card>
  );
}

function MembershipCard({ card }: { card: MembershipCardScan['card'] }) {
  if (!card) return <Card>Členská karta nenalezena.</Card>;
  const st = STATUS_LABELS[card.status] ?? { label: card.status, cls: 'bg-neutral-200' };
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-gradient-to-br from-neutral-900 to-neutral-700 p-5 text-white shadow-md">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-300">Členská karta</p>
            <p className="mt-1 text-lg font-semibold">{card.member.name}</p>
          </div>
          <span className={`rounded-full px-2 py-1 text-xs font-medium ${st.cls}`}>{st.label}</span>
        </div>
        <p className="mt-6 text-2xl font-bold">{card.tier.name}</p>
        <p className="mt-1 text-xs text-neutral-300">
          Platnost do {fmtDate(card.validTo)}
        </p>
      </div>

      {card.benefits.length > 0 && (
        <Card>
          <h3 className="mb-2 text-sm font-medium text-neutral-500">Výhody</h3>
          <ul className="space-y-1 text-sm">
            {card.benefits.map((b, i) => (
              <li key={i} className="flex justify-between">
                <span>{BENEFIT_LABELS[b.kind] ?? b.kind}</span>
                {b.value && <span className="font-medium">{b.value}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {card.zoneKeys.length > 0 && (
        <Card>
          <h3 className="mb-2 text-sm font-medium text-neutral-500">Přístup do zón</h3>
          <div className="flex flex-wrap gap-2">
            {card.zoneKeys.map((z) => (
              <span key={z} className="rounded-full bg-neutral-100 px-3 py-1 text-xs">
                {z}
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      {children}
    </section>
  );
}
