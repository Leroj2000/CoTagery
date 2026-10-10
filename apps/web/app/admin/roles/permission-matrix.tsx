'use client';

import { Lock, ShieldAlert } from 'lucide-react';
import {
  PERMISSION_COLUMNS,
  type PermissionCell,
  type PermissionRow,
  type PermissionSection,
} from '@tagery/shared';

/**
 * Matice oprávnění: řádek = oblast, sloupce Zobrazit / Zakládat / Upravovat /
 * Mazat + speciální akce. Na mobilu se řádky skládají do karet s přepínači.
 * Zamčené buňky (aktér oprávnění sám nemá / roli nesmí upravit) jsou jen ke čtení.
 */
export function PermissionMatrix({
  sections,
  value,
  canToggle,
  onChange,
}: {
  sections: PermissionSection[];
  value: Set<string>;
  /** Smí uživatel tuto buňku přepnout? */
  canToggle: (key: string) => boolean;
  onChange: (next: Set<string>) => void;
}) {
  function toggle(row: PermissionRow, cell: PermissionCell, on: boolean) {
    const next = new Set(value);
    const view = row.cells.find((c) => c.column === 'view');
    if (on) {
      next.add(cell.key);
      // Kdo smí se zdrojem cokoli, musí ho i vidět.
      if (view && cell.column !== 'view' && canToggle(view.key)) next.add(view.key);
    } else {
      next.delete(cell.key);
      // Bez „zobrazit" nedávají ostatní akce smysl → vypni i je.
      if (cell.column === 'view') {
        for (const c of row.cells) if (canToggle(c.key)) next.delete(c.key);
      }
    }
    onChange(next);
  }

  function toggleRow(row: PermissionRow, on: boolean) {
    const next = new Set(value);
    for (const c of row.cells) {
      if (!canToggle(c.key)) continue;
      if (on) next.add(c.key);
      else next.delete(c.key);
    }
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-6">
      {sections.map((section) => (
        <section key={section.key}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {section.label}
          </h3>

          {/* Desktop: tabulka */}
          <div className="hidden overflow-hidden rounded-xl border border-slate-200 md:block">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Oblast</th>
                  {PERMISSION_COLUMNS.map((c) => (
                    <th key={c.key} className="w-24 px-2 py-2 text-center font-medium">
                      {c.label}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-left font-medium">Další</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {section.rows.map((row) => (
                  <tr key={row.resource} className="hover:bg-slate-50/60">
                    <td className="px-3 py-2">
                      <RowLabel
                        row={row}
                        value={value}
                        canToggle={canToggle}
                        onToggle={toggleRow}
                      />
                    </td>
                    {PERMISSION_COLUMNS.map((col) => {
                      const cell = row.cells.find((c) => c.column === col.key);
                      return (
                        <td key={col.key} className="px-2 py-2 text-center">
                          {cell ? (
                            <Check
                              cell={cell}
                              checked={value.has(cell.key)}
                              disabled={!canToggle(cell.key)}
                              label={`${row.label}: ${col.label}`}
                              onChange={(on) => toggle(row, cell, on)}
                            />
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        {row.cells
                          .filter((c) => c.column === 'extra')
                          .map((cell) => (
                            <label key={cell.key} className="inline-flex items-center gap-1.5">
                              <Check
                                cell={cell}
                                checked={value.has(cell.key)}
                                disabled={!canToggle(cell.key)}
                                label={`${row.label}: ${cell.label}`}
                                onChange={(on) => toggle(row, cell, on)}
                              />
                              <span className="text-slate-700">{cell.label}</span>
                            </label>
                          ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobil: karty */}
          <div className="flex flex-col gap-2 md:hidden">
            {section.rows.map((row) => (
              <div key={row.resource} className="rounded-xl border border-slate-200 bg-white p-3">
                <RowLabel row={row} value={value} canToggle={canToggle} onToggle={toggleRow} />
                <div className="mt-2 flex flex-wrap gap-2">
                  {row.cells.map((cell) => {
                    const label =
                      cell.label ?? PERMISSION_COLUMNS.find((c) => c.key === cell.column)?.label;
                    const checked = value.has(cell.key);
                    const disabled = !canToggle(cell.key);
                    return (
                      <label
                        key={cell.key}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ring-1 ring-inset ${
                          checked
                            ? 'bg-brand-50 text-brand-800 ring-brand-200'
                            : 'bg-white text-slate-600 ring-slate-200'
                        } ${disabled ? 'opacity-60' : ''}`}
                      >
                        <Check
                          cell={cell}
                          checked={checked}
                          disabled={disabled}
                          label={`${row.label}: ${label}`}
                          onChange={(on) => toggle(row, cell, on)}
                        />
                        {label}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function RowLabel({
  row,
  value,
  canToggle,
  onToggle,
}: {
  row: PermissionRow;
  value: Set<string>;
  canToggle: (key: string) => boolean;
  onToggle: (row: PermissionRow, on: boolean) => void;
}) {
  const togglable = row.cells.filter((c) => canToggle(c.key));
  const all = row.cells.every((c) => value.has(c.key));
  return (
    <div className="flex items-center gap-2">
      {togglable.length > 1 ? (
        <input
          type="checkbox"
          aria-label={`${row.label}: vše`}
          title="Vše v řádku"
          checked={all}
          onChange={(e) => onToggle(row, e.target.checked)}
          className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600"
        />
      ) : (
        <span className="w-3.5" />
      )}
      <span className="font-medium text-slate-800">{row.label}</span>
    </div>
  );
}

function Check({
  cell,
  checked,
  disabled,
  label,
  onChange,
}: {
  cell: PermissionCell;
  checked: boolean;
  disabled: boolean;
  label: string;
  onChange: (on: boolean) => void;
}) {
  return (
    <span className="relative inline-flex items-center">
      <input
        type="checkbox"
        aria-label={label}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        title={
          disabled
            ? 'Zamčeno – toto oprávnění nemůžeš měnit (nemáš ho sám, nebo roli nesmíš upravit)'
            : cell.sensitive
              ? 'Citlivé oprávnění'
              : undefined
        }
        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 disabled:cursor-not-allowed"
      />
      {cell.sensitive && (
        <ShieldAlert size={12} className="ml-0.5 text-amber-500" aria-label="Citlivé oprávnění" />
      )}
      {disabled && !checked && <Lock size={10} className="ml-0.5 text-slate-300" aria-hidden />}
    </span>
  );
}
