import Link from 'next/link';

const TABS = [
  { key: 'webhooks', href: '/admin/webhooks', label: 'Webhooky' },
  { key: 'channels', href: '/admin/webhooks/channels', label: 'Propojené kanály' },
] as const;

export type IntegrationsTab = (typeof TABS)[number]['key'];

/**
 * Záložky sekce Integrace. Webhooky vyžadují core.integration.manage, propojené
 * kanály jsou osobní nastavení každého přihlášeného uživatele.
 */
export function IntegrationsTabs({
  current,
  canManageWebhooks,
}: {
  current: IntegrationsTab;
  canManageWebhooks: boolean;
}) {
  const tabs = TABS.filter((t) => t.key !== 'webhooks' || canManageWebhooks);
  return (
    <nav className="flex gap-1 border-b border-slate-200" aria-label="Integrace">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === current ? 'page' : undefined}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
            t.key === current
              ? 'border-brand-600 text-brand-700'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
