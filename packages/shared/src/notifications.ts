/**
 * Notifikace (e-mail) – katalog sdílený API a webem. Firma v Nastavení →
 * Notifikace zapíná/vypíná provozní notifikace a upravuje texty; systémové
 * (pozvánka, ověření e-mailu, reset hesla) nejdou vypnout. Texty jsou šablony
 * s proměnnými `{{nazev}}`; odstavce odděluje prázdný řádek, odkaz/tlačítko se
 * píše `[Text](url)` (např. `[Otevřít Tagery]({{odkaz}})`).
 */

export type NotificationGroup = 'account' | 'movements' | 'requests' | 'attention';

/** Kdo text spravuje: firma (Nastavení → Notifikace), nebo Tagery (Platforma). */
export type NotificationScope = 'tenant' | 'platform';

export interface NotificationVariable {
  key: string;
  label: string;
  /** Ukázková hodnota pro náhled a zkušební e-mail. */
  example: string;
}

export interface NotificationDef {
  key: string;
  group: NotificationGroup;
  label: string;
  description: string;
  /** Komu se posílá (popis pro UI). */
  recipients: string;
  /** Systémová – nelze vypnout. */
  system: boolean;
  scope: NotificationScope;
  /** Výchozí stav u provozních notifikací (systémové jsou vždy zapnuté). */
  defaultEnabled: boolean;
  variables: NotificationVariable[];
  /** Proměnné, které text musí obsahovat (např. odkaz pro přijetí pozvánky). */
  requiredVariables: string[];
  defaultSubject: string;
  defaultBody: string;
}

export const NOTIFICATION_GROUP_LABELS: Record<NotificationGroup, string> = {
  account: 'Účet a přístup',
  movements: 'Výdej a vracení',
  requests: 'Požadavky',
  attention: 'Vyžaduje pozornost',
};

const v = (key: string, label: string, example: string): NotificationVariable => ({
  key,
  label,
  example,
});

const NAME = v('jmeno', 'Jméno příjemce', 'Jana Nováková');
const FIRM = v('firma', 'Název firmy', 'Stavby Novák s.r.o.');
const ITEM = v('polozka', 'Název položky', 'Aku vrtačka Makita DDF485');
const INV = v('inventarni_cislo', 'Inventární číslo', 'INV-0042');

export const NOTIFICATIONS: NotificationDef[] = [
  {
    key: 'invitation',
    group: 'account',
    label: 'Pozvánka do firmy',
    description: 'Když někoho pozvete jako uživatele firmy.',
    recipients: 'Pozvaný uživatel',
    system: true,
    scope: 'tenant',
    defaultEnabled: true,
    variables: [
      NAME,
      FIRM,
      v('odkaz', 'Odkaz pro přijetí pozvánky', 'https://app.tagery.tech/accept-invite?token=…'),
    ],
    requiredVariables: ['odkaz'],
    defaultSubject: 'Pozvánka do {{firma}} – Tagery',
    defaultBody:
      'Ahoj {{jmeno}},\n\n' +
      'byl(a) jsi pozván(a) do firmy {{firma}} v aplikaci Tagery.\n\n' +
      '[Přijmout pozvánku]({{odkaz}})\n\n' +
      'Odkaz je jednorázový a platí 24 hodin.',
  },
  {
    key: 'email_verification',
    group: 'account',
    label: 'Ověření e-mailu',
    description: 'Po registraci nové firmy – potvrzení e-mailové adresy.',
    recipients: 'Zakladatel firmy',
    system: true,
    scope: 'platform',
    defaultEnabled: true,
    variables: [
      NAME,
      FIRM,
      v('odkaz', 'Odkaz pro ověření', 'https://app.tagery.tech/verify-email?token=…'),
    ],
    requiredVariables: ['odkaz'],
    defaultSubject: 'Ověření e-mailu – Tagery',
    defaultBody:
      'Ahoj {{jmeno}},\n\n' +
      'pro dokončení registrace firmy {{firma}} ověř svůj e-mail.\n\n' +
      '[Ověřit e-mail]({{odkaz}})\n\n' +
      'Odkaz je jednorázový a platí 24 hodin.',
  },
  {
    key: 'password_reset',
    group: 'account',
    label: 'Obnovení hesla',
    description: 'Když uživatel požádá o nové heslo.',
    recipients: 'Uživatel, který žádá o reset',
    system: true,
    scope: 'platform',
    defaultEnabled: true,
    variables: [
      NAME,
      v('odkaz', 'Odkaz pro nastavení hesla', 'https://app.tagery.tech/reset?token=…'),
    ],
    requiredVariables: ['odkaz'],
    defaultSubject: 'Obnovení hesla – Tagery',
    defaultBody:
      'Ahoj {{jmeno}},\n\n' +
      'pro nastavení nového hesla klikni na odkaz (platí 1 hodinu):\n\n' +
      '[Nastavit nové heslo]({{odkaz}})\n\n' +
      'Pokud jsi o obnovení nežádal(a), tento e-mail ignoruj.',
  },
  {
    key: 'asset_issued',
    group: 'movements',
    label: 'Vydání položky',
    description: 'Když je položka vydána, půjčena nebo předána osobě.',
    recipients: 'Osoba, které byla položka vydána (pokud má e-mail)',
    system: false,
    scope: 'tenant',
    defaultEnabled: false,
    variables: [
      NAME,
      FIRM,
      ITEM,
      INV,
      v('termin_vraceni', 'Termín vrácení', '24. 10. 2026'),
      v('odkaz', 'Odkaz na Moje vybavení', 'https://app.tagery.tech/admin/me'),
    ],
    requiredVariables: [],
    defaultSubject: 'Převzal(a) jsi {{polozka}} – {{firma}}',
    defaultBody:
      'Ahoj {{jmeno}},\n\n' +
      'byla ti vydána položka {{polozka}} ({{inventarni_cislo}}).\n\n' +
      'Termín vrácení: {{termin_vraceni}}\n\n' +
      '[Moje vybavení]({{odkaz}})',
  },
  {
    key: 'return_overdue',
    group: 'movements',
    label: 'Upomínka po termínu vrácení',
    description: 'Jednou denně, dokud položka po termínu není vrácena.',
    recipients: 'Osoba, která má položku (pokud má e-mail)',
    system: false,
    scope: 'tenant',
    defaultEnabled: false,
    variables: [
      NAME,
      FIRM,
      ITEM,
      INV,
      v('termin_vraceni', 'Termín vrácení', '10. 10. 2026'),
      v('dni_po_terminu', 'Počet dní po termínu', '3'),
    ],
    requiredVariables: [],
    defaultSubject: 'Vrať prosím {{polozka}} – {{firma}}',
    defaultBody:
      'Ahoj {{jmeno}},\n\n' +
      'položka {{polozka}} ({{inventarni_cislo}}) měla být vrácena {{termin_vraceni}} ' +
      '– je to už {{dni_po_terminu}} dní.\n\n' +
      'Vrať ji prosím, nebo se domluv na prodloužení.',
  },
  {
    key: 'reservation_created',
    group: 'requests',
    label: 'Nový požadavek',
    description: 'Když někdo vytvoří požadavek na položku.',
    recipients: 'Uživatelé, kteří smí požadavky schvalovat',
    system: false,
    scope: 'tenant',
    defaultEnabled: false,
    variables: [
      NAME,
      FIRM,
      ITEM,
      v('zadatel', 'Žadatel', 'Pavel Svoboda'),
      v('termin', 'Termín od–do', '20. 10. 2026 8:00 – 21. 10. 2026 16:00'),
      v('ucel', 'Účel', 'stavba Kladno'),
      v('odkaz', 'Odkaz na Požadavky', 'https://app.tagery.tech/admin/reservations'),
    ],
    requiredVariables: [],
    defaultSubject: 'Nový požadavek: {{polozka}}',
    defaultBody:
      'Ahoj {{jmeno}},\n\n' +
      '{{zadatel}} žádá o {{polozka}} na termín {{termin}}.\n\n' +
      'Účel: {{ucel}}\n\n' +
      '[Schválit nebo zamítnout]({{odkaz}})',
  },
  {
    key: 'reservation_decided',
    group: 'requests',
    label: 'Vyřízení požadavku',
    description: 'Když je požadavek schválen nebo zamítnut.',
    recipients: 'Žadatel (pokud má e-mail)',
    system: false,
    scope: 'tenant',
    defaultEnabled: false,
    variables: [
      NAME,
      FIRM,
      ITEM,
      v('stav', 'Výsledek (schválen / zamítnut)', 'schválen'),
      v('termin', 'Termín od–do', '20. 10. 2026 8:00 – 21. 10. 2026 16:00'),
    ],
    requiredVariables: [],
    defaultSubject: 'Požadavek na {{polozka}} byl {{stav}}',
    defaultBody:
      'Ahoj {{jmeno}},\n\n' +
      'tvůj požadavek na {{polozka}} na termín {{termin}} byl {{stav}}.\n\n' +
      '{{firma}}',
  },
  {
    key: 'attention_digest',
    group: 'attention',
    label: 'Denní souhrn',
    description:
      'Ráno souhrn toho, co vyžaduje pozornost (po termínu, nepotvrzená převzetí, závady, servis, končící záruky). Posílá se jen, když něco je.',
    recipients: 'Vlastník a manažeři firmy',
    system: false,
    scope: 'tenant',
    defaultEnabled: false,
    variables: [
      NAME,
      FIRM,
      v('souhrn', 'Souhrn (seznam)', '• Po termínu vrácení: 2\n• Servis se blíží: 1'),
      v('odkaz', 'Odkaz na Vyžaduje pozornost', 'https://app.tagery.tech/admin/attention'),
    ],
    requiredVariables: ['souhrn'],
    defaultSubject: 'Tagery: co dnes vyžaduje pozornost – {{firma}}',
    defaultBody:
      'Dobré ráno {{jmeno}},\n\n' +
      've firmě {{firma}} dnes vyžaduje pozornost:\n\n' +
      '{{souhrn}}\n\n' +
      '[Otevřít přehled]({{odkaz}})',
  },
];

export const NOTIFICATION_BY_KEY = new Map(NOTIFICATIONS.map((n) => [n.key, n]));

export const NOTIFICATION_SUBJECT_MAX = 200;
export const NOTIFICATION_BODY_MAX = 5000;

/** Proměnné použité v textu (`{{nazev}}`). */
export function templateVariables(text: string): string[] {
  return [...new Set([...text.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)].map((m) => m[1]))];
}

/** Kontrola šablony: neznámé proměnné a chybějící povinné. Vrací chyby (prázdné = OK). */
export function validateTemplate(def: NotificationDef, subject: string, body: string): string[] {
  const errors: string[] = [];
  if (!subject.trim()) errors.push('Předmět nesmí být prázdný.');
  if (!body.trim()) errors.push('Text nesmí být prázdný.');
  if (subject.length > NOTIFICATION_SUBJECT_MAX) errors.push('Předmět je příliš dlouhý.');
  if (body.length > NOTIFICATION_BODY_MAX) errors.push('Text je příliš dlouhý.');
  const known = new Set(def.variables.map((x) => x.key));
  const used = templateVariables(`${subject}\n${body}`);
  const unknown = used.filter((x) => !known.has(x));
  if (unknown.length) errors.push(`Neznámé proměnné: ${unknown.map((x) => `{{${x}}}`).join(', ')}`);
  const missing = def.requiredVariables.filter((x) => !used.includes(x));
  if (missing.length)
    errors.push(`Text musí obsahovat: ${missing.map((x) => `{{${x}}}`).join(', ')}`);
  return errors;
}

/** Dosadí proměnné (neznámé/chybějící hodnoty = prázdný řetězec). */
export function fillTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_m, k: string) => vars[k] ?? '');
}

const escapeHtml = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** Bezpečná URL odkazu (jen http/https/mailto). */
function safeUrl(url: string): string | null {
  const u = url.trim();
  return /^(https?:\/\/|mailto:)/i.test(u) ? u : null;
}

/**
 * Vykreslí e-mail ze šablony: text (bez formátování, odkazy jako „Text: url") a
 * HTML (odstavce, odkazy/tlačítka). Hodnoty proměnných se escapují – uživatelský
 * obsah nemůže vložit HTML.
 */
export function renderEmail(
  subjectTpl: string,
  bodyTpl: string,
  vars: Record<string, string>,
): { subject: string; text: string; html: string } {
  const subject = fillTemplate(subjectTpl, vars).replace(/\s+/g, ' ').trim();
  // Proměnné se dosazují až po rozdělení na odstavce a odkazy, aby hodnota s
  // `[x](y)` nebo prázdnými řádky nezměnila strukturu e-mailu.
  const paragraphs = bodyTpl.replace(/\r\n/g, '\n').split(/\n\s*\n/);
  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g;

  const textParts: string[] = [];
  const htmlParts: string[] = [];
  for (const para of paragraphs) {
    let text = '';
    let html = '';
    let last = 0;
    let onlyLink = true;
    for (const m of para.matchAll(linkRe)) {
      const before = para.slice(last, m.index);
      if (before.trim()) onlyLink = false;
      text += fillTemplate(before, vars);
      html += escapeHtml(fillTemplate(before, vars)).replace(/\n/g, '<br>');
      const label = fillTemplate(m[1], vars);
      const url = safeUrl(fillTemplate(m[2], vars));
      text += url ? `${label}: ${url}` : label;
      html += url
        ? `<a href="${escapeHtml(url)}" style="color:#4f46e5">${escapeHtml(label)}</a>`
        : escapeHtml(label);
      last = (m.index ?? 0) + m[0].length;
    }
    const rest = para.slice(last);
    if (rest.trim()) onlyLink = false;
    text += fillTemplate(rest, vars);
    html += escapeHtml(fillTemplate(rest, vars)).replace(/\n/g, '<br>');
    if (!text.trim()) continue;
    textParts.push(text.trim());
    // Odstavec jen s odkazem = tlačítko.
    const single = [...para.matchAll(linkRe)];
    if (onlyLink && single.length === 1) {
      const url = safeUrl(fillTemplate(single[0][2], vars));
      if (url) {
        htmlParts.push(
          `<p style="margin:20px 0"><a href="${escapeHtml(url)}" style="background:#4f46e5;color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">${escapeHtml(fillTemplate(single[0][1], vars))}</a></p>`,
        );
        continue;
      }
    }
    htmlParts.push(`<p style="margin:0 0 14px">${html.trim()}</p>`);
  }
  const html =
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#0f172a;max-width:560px">` +
    htmlParts.join('') +
    `<p style="margin:24px 0 0;color:#94a3b8;font-size:12px">Tagery</p></div>`;
  return { subject, text: `${textParts.join('\n\n')}\n\nTagery`, html };
}

/** Ukázkové hodnoty proměnných (náhled, zkušební e-mail). */
export function exampleVariables(def: NotificationDef): Record<string, string> {
  return Object.fromEntries(def.variables.map((x) => [x.key, x.example]));
}
