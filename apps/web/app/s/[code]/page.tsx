'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, ArrowRight } from 'lucide-react';
import { Logo } from '../../ui/logo';
import { fetchScan, type ScanResult, type MembershipCardScan } from '../../lib/api';

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  active: { label: 'Aktivní', cls: 'bg-emerald-400/20 text-emerald-100 ring-emerald-300/30' },
  expired: { label: 'Vypršelo', cls: 'bg-red-400/20 text-red-100 ring-red-300/30' },
  suspended: { label: 'Pozastaveno', cls: 'bg-amber-400/20 text-amber-100 ring-amber-300/30' },
  cancelled: { label: 'Zrušeno', cls: 'bg-white/15 text-white/80 ring-white/20' },
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
    <main className="bg-brand-radial min-h-dvh">
      <div className="mx-auto flex max-w-md flex-col gap-6 p-6">
        <header className="flex items-center justify-between pt-6">
          <Logo />
          <span className="font-mono text-xs text-slate-400">{code}</span>
        </header>

        {error && (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            Chyba: {error}
          </div>
        )}
        {!error && !state && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 size={16} className="animate-spin" /> Načítám…
          </div>
        )}

        {state && <ScanBody code={code} status={state.status} body={state.body} />}
      </div>
    </main>
  );
}

function ScanBody({ code, status, body }: { code: string; status: number; body: ScanResult }) {
  if (status === 404) return <Card>Neznámý kód.</Card>;
  if (status === 410) return <Card>Kód není aktivní nebo vypršel.</Card>;

  if ('status' in body && body.status === 'unassigned') {
    return (
      <Card>
        <p className="mb-4 text-sm text-slate-600">Tento kód zatím není přiřazený.</p>
        <Link
          href={`/activate/${code}`}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700"
        >
          Aktivovat kód <ArrowRight size={15} />
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
        <h2 className="text-lg font-semibold text-slate-900">{p?.name ?? 'Produkt'}</h2>
        {p?.brand && <p className="mt-0.5 text-sm text-slate-500">{p.brand}</p>}
        {p?.description && <p className="mt-2 text-sm text-slate-600">{p.description}</p>}
      </Card>
    );
  }

  return (
    <Card>
      <pre className="overflow-x-auto text-xs text-slate-600">{JSON.stringify(body, null, 2)}</pre>
    </Card>
  );
}

function MembershipCard({ card }: { card: MembershipCardScan['card'] }) {
  if (!card) return <Card>Členská karta nenalezena.</Card>;
  const st = STATUS_LABELS[card.status] ?? {
    label: card.status,
    cls: 'bg-white/15 text-white/80 ring-white/20',
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-brand-700 to-indigo-900 p-6 text-white shadow-elevate">
        <div className="absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10" />
        <div className="absolute -bottom-12 -left-6 h-32 w-32 rounded-full bg-white/5" />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-white/70">Členská karta</p>
            <p className="mt-1 text-lg font-semibold">{card.member.name}</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${st.cls}`}>
            {st.label}
          </span>
        </div>
        <p className="relative mt-8 text-2xl font-bold tracking-tight">{card.tier.name}</p>
        <p className="relative mt-1 text-xs text-white/70">Platnost do {fmtDate(card.validTo)}</p>
      </div>

      {card.benefits.length > 0 && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Výhody</h3>
          <ul className="flex flex-col gap-2 text-sm">
            {card.benefits.map((b, i) => (
              <li key={i} className="flex items-center justify-between">
                <span className="text-slate-600">{BENEFIT_LABELS[b.kind] ?? b.kind}</span>
                {b.value && <span className="font-semibold text-brand-700">{b.value}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {card.zoneKeys.length > 0 && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold text-slate-800">Přístup do zón</h3>
          <div className="flex flex-wrap gap-2">
            {card.zoneKeys.map((z) => (
              <span
                key={z}
                className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-200"
              >
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
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">{children}</section>
  );
}
