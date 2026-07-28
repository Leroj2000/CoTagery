'use client';

import { useEffect, useState } from 'react';
import type { HealthStatus } from '@tagery/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export default function Home() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/health`)
      .then((res) => res.json() as Promise<HealthStatus>)
      .then(setHealth)
      .catch((err: unknown) => setError(String(err)));
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
      <header className="pt-8">
        <h1 className="text-2xl font-semibold">Tagery</h1>
        <p className="text-sm text-neutral-500">Multi-tenant QR/NFC platforma — skeleton</p>
      </header>

      <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="mb-2 text-sm font-medium text-neutral-500">Stav API</h2>
        {error && <p className="text-sm text-red-600">Nedostupné: {error}</p>}
        {!error && !health && <p className="text-sm text-neutral-400">Načítám…</p>}
        {health && (
          <ul className="space-y-1 text-sm">
            <li>
              Status: <span className="font-medium">{health.status}</span>
            </li>
            <li>Databáze: {health.checks.database}</li>
            <li>Redis: {health.checks.redis}</li>
            <li className="text-neutral-400">uptime {health.uptimeSeconds}s</li>
          </ul>
        )}
      </section>
    </main>
  );
}
