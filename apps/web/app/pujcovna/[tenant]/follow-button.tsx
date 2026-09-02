'use client';

import { useEffect, useState } from 'react';
import { Heart, Loader2 } from 'lucide-react';

/**
 * Follow tlačítko na storefrontu. Stav i akce jdou přes BFF (renter cookie).
 * Nepřihlášený nájemce → odkaz na přihlášení s návratem zpět.
 */
export function FollowButton({
  tenantId,
  tenantSlug,
  initialFollowerCount,
}: {
  tenantId: string;
  tenantSlug: string;
  initialFollowerCount: number;
}) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [following, setFollowing] = useState(false);
  const [count, setCount] = useState(initialFollowerCount);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/network/follow/${tenantId}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { authenticated: boolean; following: boolean }) => {
        if (!active) return;
        setAuthenticated(d.authenticated);
        setFollowing(d.following);
      })
      .catch(() => active && setAuthenticated(false));
    return () => {
      active = false;
    };
  }, [tenantId]);

  async function toggle() {
    setBusy(true);
    const method = following ? 'DELETE' : 'POST';
    const res = await fetch(`/api/network/follow/${tenantId}`, { method });
    setBusy(false);
    if (res.ok) {
      setCount((c) => c + (following ? -1 : 1));
      setFollowing((f) => !f);
    }
  }

  const countLabel = `${count} ${count === 1 ? 'sledující' : count >= 2 && count <= 4 ? 'sledující' : 'sledujících'}`;

  if (authenticated === false) {
    return (
      <a
        href={`/najem/prihlaseni?next=/pujcovna/${tenantSlug}`}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        <Heart size={16} /> Sledovat <span className="text-slate-400">· {countLabel}</span>
      </a>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={busy || authenticated === null}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition disabled:opacity-60 ${
        following
          ? 'border border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100'
          : 'bg-brand-600 text-white hover:bg-brand-700'
      }`}
    >
      {busy ? <Loader2 size={16} className="animate-spin" /> : <Heart size={16} fill={following ? 'currentColor' : 'none'} />}
      {following ? 'Sleduješ' : 'Sledovat'}
      <span className={following ? 'text-brand-400' : 'text-white/70'}>· {countLabel}</span>
    </button>
  );
}
