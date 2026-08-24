'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

export function RenterLogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch('/api/renter/logout', { method: 'POST' });
        router.push('/najem/prihlaseni');
        router.refresh();
      }}
      className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
    >
      <LogOut size={15} /> Odhlásit
    </button>
  );
}
