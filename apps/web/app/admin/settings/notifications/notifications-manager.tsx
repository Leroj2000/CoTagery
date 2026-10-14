'use client';

import { useState } from 'react';
import { Loader2, Lock, Pencil } from 'lucide-react';
import {
  NOTIFICATION_BY_KEY,
  NOTIFICATION_GROUP_LABELS,
  type NotificationGroup,
} from '@tagery/shared';
import { Badge, Section } from '../../ui';
import type { NotificationsOverview, NotificationSettingView } from '../../../lib/notifications';
import { TemplateEditor } from './template-editor';

const LOG_STATUS: Record<string, { label: string; tone: 'green' | 'red' | 'slate' | 'brand' }> = {
  sent: { label: 'Odesláno', tone: 'green' },
  failed: { label: 'Chyba', tone: 'red' },
  skipped: { label: 'Přeskočeno', tone: 'slate' },
  test: { label: 'Zkušební', tone: 'brand' },
};

function fmtTime(iso: string): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Prague',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return `${p.day}. ${p.month}. ${p.year} ${p.hour}:${p.minute}`;
}

function Switch({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${
        checked ? 'bg-brand-600' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

/** Nastavení → Notifikace: zapínání, texty, přístup manažerů, historie. */
export function NotificationsManager({ initial }: { initial: NotificationsOverview }) {
  const [data, setData] = useState(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(path: string, body: unknown): Promise<string | null> {
    setError(null);
    const res = await fetch(`/api/notifications/${path}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as
      (NotificationsOverview & { message?: string | string[] }) | null;
    if (!res.ok || !json) {
      const m = json?.message;
      return (Array.isArray(m) ? m.join(' ') : m) || `Chyba ${res.status}`;
    }
    setData(json);
    return null;
  }

  async function toggle(item: NotificationSettingView, enabled: boolean) {
    setBusy(item.key);
    const err = await call(item.key, { enabled });
    if (err) setError(err);
    setBusy(null);
  }

  const groups = (Object.keys(NOTIFICATION_GROUP_LABELS) as NotificationGroup[]).map((g) => ({
    g,
    items: data.items.filter((i) => i.group === g),
  }));

  return (
    <div className="flex flex-col gap-6">
      {data.isOwner && (
        <Section
          title="Kdo smí notifikace spravovat"
          description="Vlastník vždy. Manažerům můžeš správu notifikací povolit."
        >
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-slate-700">
              Manažeři smí měnit notifikace a jejich texty
            </span>
            <Switch
              label="Povolit manažerům"
              checked={data.managerAccess}
              disabled={busy === 'access'}
              onChange={async (v) => {
                setBusy('access');
                const err = await call('manager-access', { allowed: v });
                if (err) setError(err);
                setBusy(null);
              }}
            />
          </div>
        </Section>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-100">
          {error}
        </p>
      )}

      {groups.map(({ g, items }) =>
        items.length ? (
          <Section key={g} title={NOTIFICATION_GROUP_LABELS[g]}>
            <ul className="flex flex-col divide-y divide-slate-100">
              {items.map((item) => (
                <li key={item.key} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-800">
                        {item.label}
                        {item.system && <Badge tone="slate">vždy zapnuto</Badge>}
                        {item.scope === 'platform' && (
                          <Badge tone="slate">
                            <Lock size={11} className="mr-1" /> text spravuje Tagery
                          </Badge>
                        )}
                        {item.customized && <Badge tone="brand">upravený text</Badge>}
                      </p>
                      <p className="text-xs text-slate-500">{item.description}</p>
                      <p className="text-xs text-slate-400">Komu: {item.recipients}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setOpen(open === item.key ? null : item.key)}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                      >
                        <Pencil size={13} /> {item.editable ? 'Upravit text' : 'Zobrazit text'}
                      </button>
                      {busy === item.key && (
                        <Loader2 size={15} className="animate-spin text-slate-400" />
                      )}
                      <Switch
                        label={`Zapnout ${item.label}`}
                        checked={item.enabled}
                        disabled={item.system || busy === item.key}
                        onChange={(v) => void toggle(item, v)}
                      />
                    </div>
                  </div>
                  {open === item.key && (
                    <TemplateEditor
                      key={`${item.key}:${item.subject}:${item.body}`}
                      item={item}
                      apiBase="/api/notifications"
                      readOnly={!item.editable}
                      onClose={() => setOpen(null)}
                      onSaved={(subject, body) => call(item.key, { subject, body })}
                    />
                  )}
                </li>
              ))}
            </ul>
          </Section>
        ) : null,
      )}

      <Section title="Historie odeslaných" description="Posledních 50 e-mailů firmy.">
        {data.log.length === 0 ? (
          <p className="text-sm text-slate-400">Zatím nic neodešlo.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100 text-sm">
            {data.log.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span className="w-32 shrink-0 text-xs text-slate-400">{fmtTime(l.createdAt)}</span>
                <span className="font-medium text-slate-800">
                  {NOTIFICATION_BY_KEY.get(l.key)?.label ?? l.key}
                </span>
                <span className="text-slate-500">{l.recipient}</span>
                <span className="ml-auto">
                  <Badge tone={LOG_STATUS[l.status]?.tone ?? 'slate'}>
                    {LOG_STATUS[l.status]?.label ?? l.status}
                  </Badge>
                </span>
                {l.error && <span className="w-full text-xs text-red-600">{l.error}</span>}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
