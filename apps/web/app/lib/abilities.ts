/**
 * UI oprávnění odvozená z efektivních permissions (`/authz/my-permissions`).
 * Backend je autoritativní (guardy vrací 403); tady jen skrýváme formuláře,
 * které by identita stejně nemohla odeslat (např. role Náhled).
 */
type Perms = ReadonlySet<string>;

export const NO_PERMISSION_NOTE = 'Nemáte oprávnění k této akci – požádejte správce.';

export interface AssetAbilities {
  /** Úprava položky, servis/revize, odečty, kontejnery. */
  canEdit: boolean;
  /** Výdej, vrácení, předání a potvrzení převzetí. */
  canMove: boolean;
  /** Přidání/adopce QR a NFC identifikátorů. */
  canCarrier: boolean;
  /** Nahlášení a vyřešení problému. */
  canIssue: boolean;
  canManagePhotos: boolean;
  canEditPurchase: boolean;
}

export function assetAbilities(perms: Perms): AssetAbilities {
  return {
    canEdit: perms.has('asset.item.update'),
    canMove: perms.has('asset.movement.perform'),
    canCarrier: perms.has('carrier.item.manage'),
    canIssue: perms.has('asset.issue.manage'),
    canManagePhotos: perms.has('asset.media.manage'),
    canEditPurchase: perms.has('asset.purchase.update'),
  };
}

/** Formulář „Pozvat uživatele“ jen s právem pozvat (Náhled seznam vidí, ale nezve). */
export function canInviteMembers(perms: Perms): boolean {
  return perms.has('core.member.invite');
}

export interface NavGateItem {
  href: string;
  moduleKey?: string;
  permission?: string;
}

/** Href položek navigace, které se identitě nezobrazí. */
export function hiddenNavHrefs(
  items: readonly NavGateItem[],
  ctx: { perms: Perms; inactiveModules: ReadonlySet<string>; canManageNotifications: boolean },
): string[] {
  return items
    .filter(
      (item) =>
        (item.moduleKey && ctx.inactiveModules.has(item.moduleKey)) ||
        (item.permission && !ctx.perms.has(item.permission)) ||
        (item.href === '/admin/settings/notifications' && !ctx.canManageNotifications),
    )
    .map((item) => item.href);
}
