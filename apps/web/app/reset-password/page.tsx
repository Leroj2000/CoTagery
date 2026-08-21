'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { Logo } from '../ui/logo';

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10';

function ResetForm() {
  const token = useSearchParams().get('token') ?? '';
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    if (pw.length < 8) return setError('Heslo musí mít alespoň 8 znaků.');
    if (pw !== pw2) return setError('Hesla se neshodují.');
    setBusy(true);
    try {
      const res = await fetch('/api/auth/reset', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, newPassword: pw }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? 'Odkaz je neplatný nebo expirovaný.');
        return;
      }
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return <p className="text-sm text-red-600">Chybí token – použij odkaz z e-mailu.</p>;
  }
  if (done) {
    return (
      <div className="flex flex-col items-center gap-2 text-center">
        <CheckCircle2 size={28} className="text-emerald-500" />
        <p className="text-sm text-slate-700">Heslo bylo změněno. Přihlas se novým heslem.</p>
        <a href="/login" className="mt-2 text-xs font-medium text-brand-700 hover:underline">
          Přejít na přihlášení
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="pw" className="text-sm font-medium text-slate-700">Nové heslo</label>
        <input id="pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className={inputCls} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="pw2" className="text-sm font-medium text-slate-700">Nové heslo znovu</label>
        <input id="pw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} className={inputCls} />
      </div>
      {error && (
        <p className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-100">
          <AlertCircle size={15} /> {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || pw.length < 8}
        className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
      >
        {busy && <Loader2 size={16} className="animate-spin" />}
        {busy ? 'Ukládám…' : 'Nastavit heslo'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="bg-brand-radial flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo size={40} withText={false} />
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Nové heslo</h1>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-elevate">
          <Suspense fallback={<p className="text-sm text-slate-400">Načítám…</p>}>
            <ResetForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
