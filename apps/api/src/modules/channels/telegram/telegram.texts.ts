/** Texty bota (čeština; angličtina viz PLAN.md – zbývá). */
export const T = {
  notLinked:
    'Tento chat není propojený s účtem Tagery.\n\nV aplikaci otevři Profil → Propojené kanály, vygeneruj kód a pošli mi ho zprávou /start KÓD.',
  linked: (name: string) => `Hotovo, chat je propojený s účtem ${name}.`,
  badCode: 'Kód je neplatný nebo vypršel. Vygeneruj v aplikaci nový.',
  tooMany: 'Příliš mnoho pokusů, zkus to za chvíli.',
  unlinked: 'Chat byl odpojen od účtu Tagery.',
  help: [
    'Co umím:',
    '/hledat TEXT – najít položku (stačí poslat i jen text)',
    '/pozornost – co vyžaduje pozornost',
    '/zalozit NÁZEV – založit položku (s potvrzením)',
    '/firmy – vybrat firmu',
    '/odpojit – odpojit tento chat od účtu',
  ].join('\n'),
  chooseOrg: 'Vyber firmu:',
  noOrgs: 'Nemáš aktivní členství v žádné firmě.',
  orgSelected: (name: string) => `Pracuješ ve firmě ${name}.`,
  needOrg: 'Nejdřív vyber firmu příkazem /firmy.',
  confirm: (summary: string) => `${summary}?`,
  confirmYes: 'Potvrdit',
  confirmNo: 'Zrušit',
  cancelled: 'Zrušeno.',
  expired: 'Tahle volba už neplatí. Začni prosím znovu.',
  nothingFound: 'Nic jsem nenašel.',
  created: (name: string, url: string) => `Položka „${name}" je založená.\n${url}`,
  groupsUnsupported: 'Bot funguje jen v soukromém chatu.',
  needName: 'Napiš název, např. /zalozit Vrtačka Makita',
  needQuery: 'Napiš, co hledáš, např. /hledat vrtačka',
};

export const STATUS_CS: Record<string, string> = {
  available: 'skladem',
  assigned: 'přiděleno',
  loaned: 'vypůjčeno',
  reserved: 'rezervováno',
  in_transfer: 'na cestě',
  service: 'v servisu',
  damaged: 'poškozeno',
  lost: 'ztraceno',
  retired: 'vyřazeno',
};
