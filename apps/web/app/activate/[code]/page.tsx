'use client';

import { use, useState } from 'react';
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
      const body = (await res.json().catch(() => ({}))) as
        | ActivationResult
        | { message?: string };
      if (!res.ok) {
        const msg =
          (body as { message?: string }).message ??
          (res.status === 429
            ? 'Příliš mnoho pokusů, zkuste to později.'
            : 'Aktivace se nezdařila.');
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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <header className="pt-8">
        <h1 className="text-2xl font-semibold">Aktivace kódu</h1>
        <p className="text-sm text-neutral-500">
          Kód <span className="font-mono">{code}</span>
        </p>
      </header>

      {result ? (
        <section className="rounded-xl border border-green-200 bg-green-50 p-4">
          <h2 className="mb-1 text-lg font-semibold text-green-800">Hotovo 🎉</h2>
          <p className="text-sm text-green-700">Kód byl úspěšně aktivován.</p>
          <p className="mt-3 break-all text-xs text-neutral-500">
            Uschovejte si tento odkaz pro pozdější úpravy:
            <br />
            <span className="font-mono">/edit?token={result.editToken.slice(0, 24)}…</span>
          </p>
        </section>
      ) : (
        <form
          onSubmit={submit}
          className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
        >
          <label htmlFor="pin" className="mb-2 block text-sm font-medium text-neutral-600">
            Zadejte aktivační PIN
          </label>
          <input
            id="pin"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={pin}
            onChange={(e) => setPin(e.target.value.trim())}
            placeholder="••••••"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-center text-lg tracking-widest focus:border-neutral-900 focus:outline-none"
          />
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy || pin.length < 4}
            className="mt-4 w-full rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {busy ? 'Aktivuji…' : 'Aktivovat'}
          </button>
        </form>
      )}
    </main>
  );
}
