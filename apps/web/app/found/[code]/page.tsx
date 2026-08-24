'use client';

import { use, useState } from 'react';
import { CheckCircle2, AlertCircle, Loader2, MapPin } from 'lucide-react';
import { API_URL } from '../../lib/api';

/**
 * Veřejné nahlášení nálezu (§33) – bez loginu. Nálezce naskenuje QR a pošle
 * zprávu vlastníkovi; interní údaje se nezveřejňují.
 */
export default function FoundPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/r/${encodeURIComponent(code)}/found`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message, contact: contact || undefined }),
      });
      if (!res.ok) {
        setError(res.status === 429 ? 'Příliš mnoho pokusů, zkuste později.' : 'Odeslání selhalo.');
        return;
      }
      setDone(true);
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
            <MapPin size={22} />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Našli jste tuto položku?</h1>
            <p className="mt-1 text-sm text-slate-500">
              Položka je evidovaná v Tagery. Pošlete vlastníkovi zprávu — vaše ani jeho údaje nezveřejňujeme.
            </p>
          </div>
        </div>

        {done ? (
          <div className="rounded-2xl border border-emerald-200 bg-white p-6 text-center shadow-elevate">
            <CheckCircle2 size={32} className="mx-auto text-emerald-600" />
            <h2 className="mt-2 text-lg font-semibold text-slate-900">Děkujeme! 🙏</h2>
            <p className="mt-1 text-sm text-slate-600">Vlastník byl upozorněn na váš nález.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-elevate">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Zpráva vlastníkovi *</label>
            <textarea
              required
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Např. Našel jsem to na zastávce…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10"
            />
            <label className="mb-1.5 mt-4 block text-sm font-medium text-slate-700">
              Kontakt na vás (volitelné)
            </label>
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="telefon nebo e-mail"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10"
            />
            {error && (
              <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle size={15} /> {error}
              </p>
            )}
            <button
              type="submit"
              disabled={busy || message.trim().length === 0}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
            >
              {busy && <Loader2 size={16} className="animate-spin" />}
              {busy ? 'Odesílám…' : 'Odeslat nález'}
            </button>
          </form>
        )}
        <p className="mt-4 text-center text-[11px] text-slate-400">Powered by Tagery</p>
      </div>
    </main>
  );
}
