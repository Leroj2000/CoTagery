import { redirect } from 'next/navigation';
import { IdentifiedClient } from './identified-client';

export const dynamic = 'force-dynamic';

/**
 * „Položka nalezena" – samostatná stránka po úspěšné identifikaci položky
 * (sken v aplikaci nebo odkaz „Vstoupit do aplikace" z veřejné stránky).
 * Pozorování už uložila stránka Identifikovat; zde se jen zobrazí aktuální stav.
 */
export default async function IdentifiedPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; obs?: string; acc?: string }>;
}) {
  const { code, obs, acc } = await searchParams;
  if (!code?.trim()) redirect('/admin/scan');
  const accuracy = acc && /^\d+$/.test(acc) ? Number(acc) : null;
  const observation =
    obs === 'manual'
      ? 'Poloha uložena — zadáno ručně.'
      : obs === 'gps'
        ? `Poloha přiložena${accuracy !== null ? `, přesnost ±${accuracy} m` : ''}.`
        : obs === 'none'
          ? 'Sken uložen bez polohy.'
          : null;
  return (
    <div className="mx-auto w-full max-w-xl">
      <IdentifiedClient code={code} observation={observation} />
    </div>
  );
}
