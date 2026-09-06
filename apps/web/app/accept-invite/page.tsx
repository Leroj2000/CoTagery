'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function AcceptInviteContent() {
  const token = useSearchParams().get('token') ?? '';
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await fetch('/api/auth/accept-invite', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, password: fd.get('password') }),
    });
    setDone(res.ok);
    if (!res.ok) setError('Odkaz je neplatný nebo expiroval.');
  }
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-card">
        <h1 className="text-xl font-semibold">Přijmout pozvánku</h1>
        {done ? (
          <p className="mt-4 text-sm">
            Heslo je nastavené.{' '}
            <Link className="text-brand-700" href="/login">
              Přihlásit se
            </Link>
          </p>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-3">
            <label className="block text-sm">
              Nové heslo
              <input
                name="password"
                type="password"
                minLength={10}
                required
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white">
              Nastavit heslo
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<main className="p-6 text-center">Načítám…</main>}>
      <AcceptInviteContent />
    </Suspense>
  );
}
