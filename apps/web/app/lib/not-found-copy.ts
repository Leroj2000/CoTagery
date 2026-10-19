/**
 * Texty stránek „nenalezeno“. Položka/stránka mimo aktivní firmu vrací 404
 * (RLS – cizí data nevidíme); uživatel ale musí poznat, že nejde o chybu
 * tisku/přihlášení, a co udělat (typicky přepnout firmu nebo jiný účet –
 * např. v Bluefy na iPhonu se přihlašuje znovu, často jiným účtem).
 */
export const ASSET_NOT_FOUND = {
  title: 'Položka nenalezena',
  lead: 'Tato položka v aktuálně vybrané firmě neexistuje, nebo k ní nemáte přístup.',
  hints: [
    'Patří-li položka jiné firmě, přepněte firmu vpravo nahoře.',
    'V jiném prohlížeči (např. Bluefy na iPhonu) se přihlaste stejným účtem jako na počítači.',
    'Položka mohla být smazána – zkuste ji najít v seznamu položek.',
  ],
  back: { href: '/admin/assets', label: 'Zpět na položky' },
} as const;

export const PAGE_NOT_FOUND = {
  title: 'Stránka nenalezena',
  lead: 'Tato stránka neexistuje nebo byla přesunuta.',
  back: { href: '/admin', label: 'Na úvod' },
} as const;
