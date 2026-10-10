'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Check,
  Info,
  Loader2,
  Lock,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { OWNER_ROLE_KEY, buildPermissionMatrix } from '@tagery/shared';
import type { RoleView, RolesOverview } from '../../lib/roles';
import { PermissionMatrix } from './permission-matrix';

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-500';

function roleBadge(role: RoleView): { label: string; cls: string } {
  if (!role.system)
    return { label: 'Vlastní', cls: 'bg-violet-50 text-violet-700 ring-violet-200' };
  if (role.customized)
    return { label: 'Upravená', cls: 'bg-amber-50 text-amber-700 ring-amber-200' };
  return { label: 'Systémová', cls: 'bg-slate-100 text-slate-600 ring-slate-200' };
}

/**
 * Správa rolí firmy: seznam rolí podle úrovně, editor s maticí oprávnění a
 * založení vlastní role. Pravidla delegace vynucuje API; UI je jen zrcadlí
 * (zamčené role a buňky), aby uživatel hned viděl, co smí.
 */
export function RolesManager({ initial }: { initial: RolesOverview }) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const firstEditable = initial.roles.find((r) => r.editable) ?? initial.roles[0];
  const [selectedKey, setSelectedKey] = useState(firstEditable?.key ?? '');
  const selected = data.roles.find((r) => r.key === selectedKey) ?? data.roles[0];
  const [draft, setDraft] = useState(() => new Set(selected?.permissions ?? []));
  const [name, setName] = useState(selected?.name ?? '');
  const [description, setDescription] = useState(selected?.description ?? '');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const sections = useMemo(() => buildPermissionMatrix(data.catalog), [data.catalog]);
  const grantable = useMemo(() => new Set(data.actor.grantable), [data.actor.grantable]);
  const editable = !!selected?.editable;
  const canToggle = (key: string) => editable && grantable.has(key);

  function load(role: RoleView | undefined) {
    setDraft(new Set(role?.permissions ?? []));
    setName(role?.name ?? '');
    setDescription(role?.description ?? '');
    setDirty(false);
    setError(null);
  }

  function select(key: string) {
    if (dirty && !window.confirm('Máš neuložené změny. Opravdu přepnout roli?')) return;
    setSelectedKey(key);
    setNotice(null);
    setCreating(false);
    load(data.roles.find((r) => r.key === key));
  }

  async function call(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/roles${path}`, {
        method,
        headers: { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const json = (await res.json().catch(() => null)) as
        (RolesOverview & { message?: string | string[] }) | null;
      if (!res.ok || !json?.roles) {
        const msg = Array.isArray(json?.message) ? json?.message.join(', ') : json?.message;
        throw new Error(msg || 'Akce se nepovedla.');
      }
      setData(json);
      router.refresh();
      return json;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Akce se nepovedla.');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!selected) return;
    const next = await call(`/${encodeURIComponent(selected.key)}`, 'PUT', {
      name,
      description,
      permissions: [...draft],
    });
    if (next) {
      const role = next.roles.find((r) => r.key === selected.key);
      load(role);
      // Server mohl sadu upravit (delegace, závislé „zobrazit") – ukaž proč.
      const requested = [...draft].sort().join();
      setNotice(
        role && role.permissions.join() !== requested
          ? 'Uloženo. Některá oprávnění server upravil (doplnil „zobrazit" nebo ponechal zamčená).'
          : 'Uloženo.',
      );
    }
  }

  async function reset() {
    if (!selected || !window.confirm(`Vrátit roli „${selected.name}" na výchozí oprávnění?`))
      return;
    const next = await call(`/${encodeURIComponent(selected.key)}/reset`, 'POST');
    if (next) {
      load(next.roles.find((r) => r.key === selected.key));
      setNotice('Role vrácena na výchozí.');
    }
  }

  async function remove() {
    if (!selected || !window.confirm(`Smazat roli „${selected.name}"?`)) return;
    const next = await call(`/${encodeURIComponent(selected.key)}`, 'DELETE');
    if (next) {
      const fallback = next.roles.find((r) => r.editable) ?? next.roles[0];
      setSelectedKey(fallback?.key ?? '');
      load(fallback);
      setNotice('Role smazána.');
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
        <Info size={16} className="mt-0.5 shrink-0 text-slate-400" />
        <p>
          Tvoje role: <strong className="text-slate-800">{data.actor.roleName}</strong>.{' '}
          {data.actor.canManage
            ? 'Upravovat a přidělovat můžeš jen role pod svou úrovní a zapnout jen oprávnění, která máš sám – ostatní jsou zamčená.'
            : 'Role si můžeš prohlédnout; měnit je může jen role s oprávněním „Role a oprávnění → Spravovat".'}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Seznam rolí (nahoře = vyšší úroveň) */}
        <aside className="flex min-w-0 flex-col gap-2">
          <ul className="flex flex-col gap-1.5">
            {data.roles.map((role) => {
              const badge = roleBadge(role);
              const active = role.key === selected?.key && !creating;
              return (
                <li key={role.key}>
                  <button
                    type="button"
                    onClick={() => select(role.key)}
                    aria-current={active ? 'true' : undefined}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                      active
                        ? 'border-brand-300 bg-brand-50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium text-slate-900">
                          {role.name}
                        </span>
                        {!role.editable && <Lock size={12} className="shrink-0 text-slate-400" />}
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users size={11} /> {role.memberCount}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {data.actor.canManage && (
            <button
              type="button"
              onClick={() => {
                if (dirty && !window.confirm('Máš neuložené změny. Pokračovat?')) return;
                setCreating(true);
                setError(null);
                setNotice(null);
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <Plus size={16} /> Nová role
            </button>
          )}
        </aside>

        {/* Editor */}
        <div className="min-w-0">
          {creating ? (
            <CreateRole
              data={data}
              busy={busy}
              error={error}
              onCancel={() => setCreating(false)}
              onCreate={async (payload) => {
                const before = new Set(data.roles.map((r) => r.key));
                const next = await call('', 'POST', payload);
                if (next) {
                  const created = next.roles.find((r) => !before.has(r.key));
                  setCreating(false);
                  if (created) {
                    setSelectedKey(created.key);
                    load(created);
                  }
                  setNotice('Role založena. Uprav oprávnění a ulož.');
                }
              }}
            />
          ) : selected ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-slate-700">Název role</span>
                    <input
                      value={name}
                      disabled={!editable}
                      maxLength={60}
                      onChange={(e) => {
                        setName(e.target.value);
                        setDirty(true);
                      }}
                      className={inputCls}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium text-slate-700">Popis</span>
                    <input
                      value={description}
                      disabled={!editable}
                      maxLength={300}
                      onChange={(e) => {
                        setDescription(e.target.value);
                        setDirty(true);
                      }}
                      className={inputCls}
                    />
                  </label>
                </div>
                {selected.key === OWNER_ROLE_KEY ? (
                  <p className="flex items-center gap-1.5 text-sm text-slate-600">
                    <ShieldCheck size={15} className="text-emerald-600" /> Vlastník má vždy všechna
                    oprávnění a jeho roli nelze upravit. Firma musí mít aspoň jednoho vlastníka.
                  </p>
                ) : !editable ? (
                  <p className="flex items-center gap-1.5 text-sm text-slate-500">
                    <Lock size={14} /> Tuto roli může upravit jen nadřízená role. Zobrazuje se jen
                    pro čtení.
                  </p>
                ) : null}
              </div>

              {selected.allPermissions && selected.key !== OWNER_ROLE_KEY && (
                <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
                  Role má zatím automaticky všechna oprávnění (včetně budoucích). Po uložení změn
                  bude mít jen zaškrtnutá.
                </p>
              )}

              <PermissionMatrix
                sections={sections}
                value={draft}
                canToggle={canToggle}
                onChange={(next) => {
                  setDraft(next);
                  setDirty(true);
                  setNotice(null);
                }}
              />

              {error && <p className="text-sm text-red-600">{error}</p>}
              {notice && (
                <p className="flex items-center gap-1.5 text-sm text-emerald-700">
                  <Check size={15} /> {notice}
                </p>
              )}

              {editable && (
                <div className="sticky bottom-20 z-10 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur lg:bottom-4">
                  <button
                    type="button"
                    disabled={busy || !dirty}
                    onClick={() => void save()}
                    className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Uložit roli
                  </button>
                  {dirty && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => load(selected)}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <X size={16} /> Zahodit změny
                    </button>
                  )}
                  {selected.system && selected.customized && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void reset()}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <RotateCcw size={16} /> Obnovit výchozí
                    </button>
                  )}
                  {!selected.system && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void remove()}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                    >
                      <Trash2 size={16} /> Smazat roli
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CreateRole({
  data,
  busy,
  error,
  onCancel,
  onCreate,
}: {
  data: RolesOverview;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onCreate: (payload: { name: string; description: string; belowRole: string }) => void;
}) {
  // Nová role leží těsně pod zvolenou rolí – nabídni role do úrovně aktéra.
  const parents = data.roles.filter(
    (r) =>
      r.rank <= data.actor.rank &&
      (r.key !== OWNER_ROLE_KEY || data.actor.roleKey === OWNER_ROLE_KEY) &&
      r.rank > 1,
  );
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [belowRole, setBelowRole] = useState(
    parents.find((r) => r.key === 'editor')?.key ?? parents[0]?.key ?? '',
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onCreate({ name: name.trim(), description: description.trim(), belowRole });
      }}
      className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4"
    >
      <h2 className="text-base font-semibold text-slate-900">Nová role</h2>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">Název</span>
        <input
          required
          minLength={2}
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Např. Skladník, Vedoucí směny, Externí servis"
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">Popis (nepovinný)</span>
        <input
          maxLength={300}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={inputCls}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-slate-700">Podřízená roli</span>
        <select
          value={belowRole}
          onChange={(e) => setBelowRole(e.target.value)}
          className={inputCls}
        >
          {parents.map((r) => (
            <option key={r.key} value={r.key}>
              {r.name}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-500">
          Nová role převezme oprávnění zvolené role (jen ta, která máš sám) a bude těsně pod ní – tu
          roli a role nad ní ji pak mohou spravovat a přidělovat.
        </span>
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy || name.trim().length < 2 || !belowRole}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Založit roli
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Zrušit
        </button>
      </div>
    </form>
  );
}
