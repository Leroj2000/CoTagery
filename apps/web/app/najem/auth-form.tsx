'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10';

/** Registrace/přihlášení nájemce (EPIC-19 F2). Přes BFF nastaví httpOnly cookie. */
export function RenterAuthForm({ mode, next }: { mode: 'login' | 'register'; next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'register';

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/renter/${isRegister ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(isRegister ? { email, password, name } : { email, password }),
      });
      if (res.ok) {
        router.push(next);
        router.refresh();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      setError(data.message ?? 'Něco se nepovedlo.');
    } finally {
      setBusy(false);
    }
  }

  const other = isRegister
    ? { href: `/najem/prihlaseni?next=${encodeURIComponent(next)}`, label: 'Už mám účet – přihlásit se' }
    : { href: `/najem/registrace?next=${encodeURIComponent(next)}`, label: 'Nemám účet – registrovat se' };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {isRegister && (
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">Jméno</span>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
      )}
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-600">E-mail</span>
        <input type="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-600">Heslo</span>
        <input
          type="password"
          className={inputCls}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {busy && <Loader2 size={15} className="animate-spin" />}
        {isRegister ? 'Registrovat a objednat' : 'Přihlásit se'}
      </button>
      <Link href={other.href} className="mt-1 text-center text-xs text-brand-700 hover:underline">
        {other.label}
      </Link>
    </form>
  );
}
