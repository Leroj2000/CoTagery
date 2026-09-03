export interface SelectOption {
  value: string;
  label: string;
  /** Volitelná skupina → vykreslí se jako <optgroup> (úroveň v roletce). */
  group?: string;
}

/**
 * Vykreslí <option>/<optgroup> pro <select>. Options bez `group` jsou nahoře,
 * ostatní seskupené pod svým názvem (zachová pořadí prvního výskytu skupiny).
 */
export function SelectOptions({ options }: { options: SelectOption[] }) {
  const ungrouped = options.filter((o) => !o.group);
  const groups: string[] = [];
  for (const o of options) if (o.group && !groups.includes(o.group)) groups.push(o.group);

  return (
    <>
      {ungrouped.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
      {groups.map((g) => (
        <optgroup key={g} label={g}>
          {options
            .filter((o) => o.group === g)
            .map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
        </optgroup>
      ))}
    </>
  );
}
