import type { AssetAbilities } from '../../../lib/abilities';

/** Tlačítko v řádku akcí pod dlaždicemi Patří do / Má ji / Vrátit do. */
export interface DetailAction {
  key: string;
  label: string;
  /** Kotva existující sekce/formuláře na stránce (tlačítko na ni posune). */
  href: string;
  primary?: boolean;
}

export interface DetailActionState {
  canReturn: boolean;
  otherActionCount: number;
}

/**
 * Akce na detailu položky podle oprávnění (stejné gatování jako formuláře).
 * Čistá funkce – Náhled (bez práv k zápisu) nedostane žádnou.
 */
export function detailActions(ab: AssetAbilities, state: DetailActionState): DetailAction[] {
  const out: DetailAction[] = [];
  if (ab.canMove && state.canReturn)
    out.push({ key: 'return', label: 'Vrátit', href: '#asset-return', primary: true });
  if (ab.canMove && state.otherActionCount > 0)
    out.push({
      key: 'move',
      label: 'Vydat / přesunout',
      href: '#asset-actions',
      primary: !state.canReturn,
    });
  if (ab.canIssue) out.push({ key: 'issue', label: 'Nahlásit problém', href: '#problemy' });
  if (ab.canEdit) out.push({ key: 'service', label: 'Přidat servis', href: '#servis' });
  if (ab.canCarrier) out.push({ key: 'carrier', label: 'QR / NFC', href: '#identifikator' });
  if (ab.canEdit) out.push({ key: 'edit', label: 'Upravit údaje', href: '#edit-asset' });
  return out;
}
