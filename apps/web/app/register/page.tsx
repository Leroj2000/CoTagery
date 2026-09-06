'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Logo } from '../ui/logo';

const cls =
  'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10';

export default function RegisterPage() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    const body = {
      organizationName: fd.get('organizationName'),
      ownerName: fd.get('ownerName'),
      ownerEmail: fd.get('ownerEmail'),
      password: fd.get('password'),
      includeDemoData: fd.get('includeDemoData') === 'on',
    };
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) setSent(true);
    else {
      const data = await res.json().catch(() => ({}));
      setError(data.message ?? 'Registrace se nepodařila.');
    }
    setBusy(false);
  }
  return (
    <main className="bg-brand-radial flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="mb-5 flex justify-center">
          <Logo size={42} />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-elevate">
          {sent ? (
            <div>
              <h1 className="text-xl font-semibold">Zkontrolujte e-mail</h1>
              <p className="mt-2 text-sm text-slate-600">
                Poslali jsme vám jednorázový odkaz pro ověření účtu. Platí 24 hodin.
              </p>
              <Link
                className="mt-5 inline-block text-sm text-brand-700 hover:underline"
                href="/login"
              >
                Zpět na přihlášení
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <h1 className="text-xl font-semibold">Začněte s Tagery</h1>
                <p className="text-sm text-slate-500">
                  Firma a první OWNER účet bez zásahu podpory.
                </p>
              </div>
              <label className="block text-sm">
                Název firmy
                <input className={`${cls} mt-1`} name="organizationName" required minLength={2} />
              </label>
              <label className="block text-sm">
                Vaše jméno
                <input className={`${cls} mt-1`} name="ownerName" required minLength={2} />
              </label>
              <label className="block text-sm">
                E-mail
                <input className={`${cls} mt-1`} name="ownerEmail" type="email" required />
              </label>
              <label className="block text-sm">
                Heslo
                <input
                  className={`${cls} mt-1`}
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={10}
                />
                <span className="text-xs text-slate-400">Alespoň 10 znaků.</span>
              </label>
              <label className="flex gap-2 text-sm text-slate-600">
                <input name="includeDemoData" type="checkbox" /> Přidat ukázkové místo a položku
              </label>
              {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
              <button
                disabled={busy}
                className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? 'Zakládám…' : 'Založit firmu'}
              </button>
              <p className="text-center text-xs text-slate-500">
                Už máte účet?{' '}
                <Link href="/login" className="text-brand-700 hover:underline">
                  Přihlásit se
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
