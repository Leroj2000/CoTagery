'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Logo } from '../ui/logo';
import { TENANT_LOGO_URL } from '../lib/tenant-logo';

/**
 * Hlavní logo v adminu: odkaz na úvodní stránku, za ním „for" + logo přihlášené
 * firmy. Logo firmy (a „for") se ukáže až po úspěšném načtení – firma bez loga
 * nebo role bez přístupu (404/401) vidí jen „Tagery".
 */
export function BrandLink() {
  const [tenantLogo, setTenantLogo] = useState(false);
  return (
    <Link
      href="/admin"
      aria-label="Tagery – úvodní stránka"
      className="inline-flex min-w-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      <span className="shrink-0">
        <Logo />
      </span>
      <span
        className={`min-w-0 items-center gap-2 ${tenantLogo ? 'inline-flex' : 'hidden'}`}
        aria-hidden={!tenantLogo}
      >
        <span className="text-sm font-medium italic text-slate-400">for</span>
        <img
          src={TENANT_LOGO_URL}
          alt="Logo firmy"
          onLoad={() => setTenantLogo(true)}
          onError={() => setTenantLogo(false)}
          className="h-7 w-auto max-w-[64px] object-contain sm:max-w-[96px]"
        />
      </span>
    </Link>
  );
}
