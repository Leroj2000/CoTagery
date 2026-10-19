/**
 * Předání stránky do Bluefy (iOS prohlížeč s Web Bluetooth – Niimbot na iPhonu
 * jinak nevytiskne; Safari ani Chrome na iOS Web Bluetooth nemají).
 *
 * Bluefy registruje URL schéma `bluefy://open?url=<adresa>` (dokumentuje PNN
 * Soft, autor Bluefy). Předáváme absolutní adresu včetně cesty a query.
 * Kódujeme jen znaky, které by rozbily parametr `url` (`%`, `&`, `#`, mezera) –
 * běžná adresa Tagery tak zůstane čitelná a funguje s parserem i bez dekódování.
 */
export const BLUEFY_APP_STORE_URL =
  'https://apps.apple.com/us/app/bluefy-web-ble-browser/id1492822055';

/** Query parametr, podle kterého detail po otevření v Bluefy rovnou otevře tisk. */
export const PRINT_QUERY_PARAM = 'print';

export function bluefyOpenUrl(pageUrl: string): string {
  const safe = pageUrl.replace(/[%&# ]/g, (ch) => encodeURIComponent(ch));
  return `bluefy://open?url=${safe}`;
}

/**
 * Adresa, kterou otevřít v Bluefy: aktuální stránka + `?print=<carrierId>`
 * (ostatní query zachová, hash zahodí – na detailu nenese stav).
 */
export function printHandoffPageUrl(currentHref: string, carrierId: string): string {
  const u = new URL(currentHref);
  u.hash = '';
  u.searchParams.set(PRINT_QUERY_PARAM, carrierId);
  return u.toString();
}

/** Je v adrese požadavek na automatické otevření tisku pro tento nosič? */
export function shouldAutoOpenPrint(search: string, carrierId: string): boolean {
  return new URLSearchParams(search).get(PRINT_QUERY_PARAM) === carrierId;
}
