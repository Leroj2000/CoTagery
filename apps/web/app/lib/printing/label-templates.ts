import {
  DEFAULT_LABEL_FORMAT,
  LABEL_FORMATS,
  defaultLabelTemplate,
  type LabelTemplate,
} from '@tagery/shared';

/** Odpověď `GET /label-templates` (viz API LabelTemplatesService). */
export interface LabelTemplatesView {
  defaultFormat: string;
  templates: (LabelTemplate & { custom: boolean })[];
}

/** Výchozí šablony všech formátů – fallback, když se načtení nepovede. */
export function fallbackLabelTemplates(): LabelTemplatesView {
  return {
    defaultFormat: DEFAULT_LABEL_FORMAT,
    templates: LABEL_FORMATS.map((f) => ({ ...defaultLabelTemplate(f.key), custom: false })),
  };
}

/** Načte šablony firmy přes BFF; při chybě vrátí výchozí (tisk nesmí selhat kvůli šabloně). */
export async function fetchLabelTemplates(): Promise<LabelTemplatesView> {
  try {
    const res = await fetch('/api/label-templates', { cache: 'no-store' });
    if (!res.ok) return fallbackLabelTemplates();
    return (await res.json()) as LabelTemplatesView;
  } catch {
    return fallbackLabelTemplates();
  }
}

export function templateFor(view: LabelTemplatesView, formatKey: string): LabelTemplate {
  return view.templates.find((t) => t.formatKey === formatKey) ?? defaultLabelTemplate(formatKey);
}
