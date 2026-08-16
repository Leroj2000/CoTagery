'use client';

import { use, useState } from 'react';
import { CheckCircle2, AlertCircle, Loader2, KeyRound } from 'lucide-react';
import { API_URL } from '../../lib/api';

interface ActivationResult {
  objectId: string;
  editToken: string;
  publicCode: string;
}

/**
 * Veřejná self-aktivace kódu koncovým příjemcem (PIN). Odesílá na
 * `POST /r/{code}/activate` (bez JWT). Po úspěchu ukáže potvrzení a edit-token.
 */
export default function ActivatePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ActivationResult | null>(null);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/r/${encodeURIComponent(code)}/activate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const body = (await res.json().catch(() => ({}))) as ActivationResult | { message?: string };
      if (!res.ok) {
        const msg =
          (body as { message?: string }).message ??
          (res.status === 429 ? 'Příliš mnoho pokusů, zkuste to později.' : 'Aktivace se nezdařila.');
        setError(msg);
        return;
      }
      setResult(body as ActivationResult);
    } catch (err: unknown) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="bg-brand-radial flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-elevate">
            <KeyRound size={22} />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Aktivace kódu</h1>
            <p className="mt-1 font-mono text-xs text-slate-400">{code}</p>
          </div>
        </div>

        {result ? (
          <div className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-elevate">
            <div className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 size={20} />
              <h2 className="text-lg font-semibold">Hotovo 🎉</h2>
            </div>
            <p className="mt-1 text-sm text-slate-600">Kód byl úspěšně aktivován.</p>
            <p className="mt-4 break-all rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
              Uschovejte si odkaz pro pozdější úpravy:
              <br />
              <span className="font-mono">/edit?token={result.editToken.slice(0, 24)}…</span>
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-elevate">
            <label htmlFor="pin" className="mb-2 block text-sm font-medium text-slate-700">
              Zadejte aktivační PIN
            </label>
            <input
              id="pin"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={pin}
              onChange={(e) => setPin(e.target.value.trim())}
              placeholder="••••••"
              className="w-full rounded-lg border border-slate-300 px-3 py-3 text-center text-2xl tracking-[0.4em] text-slate-900 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10"
            />
            {error && (
              <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle size={15} /> {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy || pin.length < 4}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              {busy ? 'Aktivuji…' : 'Aktivovat'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
