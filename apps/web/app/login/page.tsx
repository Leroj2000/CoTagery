'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Logo } from '../ui/logo';

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get('from') ?? '/admin';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        setError('Neplatný e-mail nebo heslo.');
        return;
      }
      router.replace(from.startsWith('/admin') ? from : '/admin');
      router.refresh();
    } catch (err: unknown) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-slate-700">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="owner@demo.tagery"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputCls}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-slate-700">
          Heslo
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputCls}
        />
      </div>
      {error && (
        <p className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-100">
          <AlertCircle size={15} /> {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || !email || password.length < 8}
        className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-4 focus:ring-brand-500/20 disabled:opacity-50"
      >
        {busy && <Loader2 size={16} className="animate-spin" />}
        {busy ? 'Přihlašuji…' : 'Přihlásit se'}
      </button>
      <a
        href="/forgot-password"
        className="text-center text-xs text-slate-500 hover:text-brand-700 hover:underline"
      >
        Zapomenuté heslo?
      </a>
      <a
        href="/register"
        className="text-center text-sm font-medium text-brand-700 hover:underline"
      >
        Založit novou firmu
      </a>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="bg-brand-radial flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Logo size={40} withText={false} />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tagery</h1>
            <p className="mt-1 text-sm text-slate-500">Přihlaste se do administrace</p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-elevate">
          <Suspense fallback={<p className="text-sm text-slate-400">Načítám…</p>}>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">
          Demo: owner@demo.tagery / demo1234
        </p>
      </div>
    </main>
  );
}
