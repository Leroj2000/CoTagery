'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Logo } from '../ui/logo';

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    try {
      await fetch('/api/auth/forgot', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="bg-brand-radial flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo size={40} withText={false} />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Zapomenuté heslo</h1>
            <p className="mt-1 text-sm text-slate-500">Pošleme odkaz pro nastavení nového hesla</p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-elevate">
          {sent ? (
            <div className="flex flex-col items-center gap-2 text-center">
              <CheckCircle2 size={28} className="text-emerald-500" />
              <p className="text-sm text-slate-700">
                Pokud e-mail patří účtu, poslali jsme na něj odkaz pro reset hesla.
              </p>
              <a href="/login" className="mt-2 text-xs text-brand-700 hover:underline">
                Zpět na přihlášení
              </a>
            </div>
          ) : (
            <form onSubmit={submit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="email" className="text-sm font-medium text-slate-700">
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="vas@email.cz"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                />
              </div>
              <button
                type="submit"
                disabled={busy || !email}
                className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
              >
                {busy && <Loader2 size={16} className="animate-spin" />}
                {busy ? 'Odesílám…' : 'Poslat odkaz'}
              </button>
              <a href="/login" className="text-center text-xs text-slate-500 hover:underline">
                Zpět na přihlášení
              </a>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
