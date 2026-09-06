'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function VerifyEmailContent() {
  const token = useSearchParams().get('token');
  const [state, setState] = useState('Ověřuji e-mail…');
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (!token) {
      setState('V odkazu chybí token.');
      return;
    }
    fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    }).then(async (r) => {
      setOk(r.ok);
      setState(
        r.ok
          ? 'E-mail je ověřený. Teď se můžete přihlásit.'
          : 'Odkaz je neplatný nebo už expiroval.',
      );
    });
  }, [token]);
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md rounded-2xl border bg-white p-6 text-center shadow-card">
        <h1 className="text-xl font-semibold">Ověření účtu</h1>
        <p className="mt-3 text-sm text-slate-600">{state}</p>
        {ok && (
          <Link
            href="/login?from=/admin/onboarding"
            className="mt-5 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Přihlásit se
          </Link>
        )}
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<main className="p-6 text-center">Načítám…</main>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
