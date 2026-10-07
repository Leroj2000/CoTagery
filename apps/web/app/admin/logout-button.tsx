'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LogOut } from 'lucide-react';

export function LogoutButton({ block = false }: { block?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout(): Promise<void> {
    setBusy(true);
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
    router.replace('/login');
    router.refresh();
  }

  return (
    <button
      onClick={logout}
      disabled={busy}
      className={`${block ? 'flex w-full justify-center py-2.5' : 'inline-flex py-1.5'} shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40`}
    >
      <LogOut size={15} />
      {busy ? '…' : 'Odhlásit'}
    </button>
  );
}
