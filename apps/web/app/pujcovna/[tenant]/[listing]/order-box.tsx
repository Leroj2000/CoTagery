'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, Loader2, LogIn } from 'lucide-react';

interface Quote {
  days: number;
  rentAmount: string;
  depositAmount: string;
  total: string;
  currency: string;
}

interface Period {
  startsAt: string;
  endsAt: string;
}

function money(v: string, currency: string): string {
  return `${Number(v).toLocaleString('cs-CZ', { maximumFractionDigits: 2 })} ${currency}`;
}

/** 'YYYY-MM-DD' → ISO v UTC v 9:00 (jednotné výchozí vyzvednutí). */
function toIso(date: string): string {
  return `${date}T09:00:00.000Z`;
}

export function OrderBox({
  tenantSlug,
  listingSlug,
  listingId,
  currency,
  isLoggedIn,
  loginHref,
}: {
  tenantSlug: string;
  listingSlug: string;
  listingId: string;
  currency: string;
  isLoggedIn: boolean;
  loginHref: string;
}) {
  const router = useRouter();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [booked, setBooked] = useState<Period[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/rental-availability/${listingId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((p: Period[]) => setBooked(Array.isArray(p) ? p : []))
      .catch(() => setBooked([]));
  }, [listingId]);

  // Přepočítej cenu, když je vybráno platné období.
  useEffect(() => {
    if (!from || !to || to <= from) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    setError(null);
    fetch('/api/rental-quote', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tenantSlug, listingSlug, startsAt: toIso(from), endsAt: toIso(to) }),
    })
      .then(async (r) => {
        const data = await r.json();
        if (cancelled) return;
        if (r.ok) setQuote(data as Quote);
        else {
          setQuote(null);
          setError((data as { message?: string }).message ?? 'Neplatné období.');
        }
      })
      .catch(() => !cancelled && setError('Nepodařilo se spočítat cenu.'));
    return () => {
      cancelled = true;
    };
  }, [from, to, tenantSlug, listingSlug]);

  async function submit(): Promise<void> {
    if (!isLoggedIn) {
      router.push(loginHref);
      return;
    }
    if (!quote) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/renter/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tenantSlug,
          listingSlug,
          startsAt: toIso(from),
          endsAt: toIso(to),
          note: note || undefined,
        }),
      });
      if (res.ok) {
        router.push('/najem/moje-vypujcky');
        return;
      }
      if (res.status === 401) {
        router.push(loginHref);
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      setError(data.message ?? 'Objednávku se nepodařilo vytvořit.');
    } finally {
      setBusy(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10';

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <CalendarClock size={16} /> Rezervace
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Od</span>
          <input type="date" min={today} value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Do</span>
          <input type="date" min={from || today} value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
        </label>
      </div>

      {booked.length > 0 && (
        <p className="mt-2 text-xs text-slate-400">
          Obsazeno:{' '}
          {booked
            .slice(0, 4)
            .map((p) => `${p.startsAt.slice(0, 10)}–${p.endsAt.slice(0, 10)}`)
            .join(', ')}
          {booked.length > 4 && ' …'}
        </p>
      )}

      <label className="mt-3 flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-600">Poznámka pro majitele (nepovinné)</span>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} />
      </label>

      {quote && (
        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>
              Půjčovné ({quote.days} {quote.days === 1 ? 'den' : quote.days < 5 ? 'dny' : 'dní'})
            </span>
            <span className="font-medium text-slate-900">{money(quote.rentAmount, quote.currency)}</span>
          </div>
          {Number(quote.depositAmount) > 0 && (
            <div className="mt-1 flex justify-between text-slate-600">
              <span>Vratná kauce</span>
              <span className="font-medium text-slate-900">{money(quote.depositAmount, quote.currency)}</span>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-base font-semibold text-slate-900">
            <span>Celkem</span>
            <span>{money(quote.total, quote.currency)}</span>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <button
        onClick={submit}
        disabled={busy || (isLoggedIn && !quote)}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {busy ? (
          <Loader2 size={16} className="animate-spin" />
        ) : isLoggedIn ? (
          'Vytvořit objednávku'
        ) : (
          <>
            <LogIn size={16} /> Přihlásit se a objednat
          </>
        )}
      </button>
      <p className="mt-2 text-center text-[11px] text-slate-400">
        Platba proběhne po potvrzení objednávky (QR / převod). {currency}
      </p>
    </div>
  );
}
