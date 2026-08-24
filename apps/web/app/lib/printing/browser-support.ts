import type { BrowserSupport } from './types';

/**
 * Detekce prostředí pro Web Bluetooth. Informativní kontrola (sekce 5 zadání) –
 * NENAHRAZUJE zachycení skutečné chyby při připojení, jen pomáhá zobrazit
 * správný návod dřív, než uživatel klikne na „Připojit tiskárnu“.
 *
 * Funkce je čistá a testovatelná: `navigator` se předává jako parametr, takže
 * během SSR na globální `navigator` nesaháme.
 */

/** Rozpozná iOS/iPadOS z user-agent stringu (včetně iPadOS hlásícího se jako Mac). */
export function isIos(ua: string, maxTouchPoints = 0): boolean {
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  // iPadOS 13+ se v Safari hlásí jako „Macintosh“ – rozlišíme přes touch.
  if (/Macintosh/i.test(ua) && maxTouchPoints > 1) return true;
  return false;
}

/** Rozpozná Firefox (nepodporuje Web Bluetooth na žádné platformě). */
export function isFirefox(ua: string): boolean {
  return /Firefox\//i.test(ua) && !/Seamonkey\//i.test(ua);
}

type SupportInput = {
  hasBluetooth: boolean;
  userAgent: string;
  maxTouchPoints?: number;
};

/**
 * Vyhodnotí podporu z předaných hodnot (bez sahání na globální objekty).
 *
 * - `hasBluetooth === true` → podporováno.
 * - jinak iOS bez Web Bluetooth → návod na Bluefy.
 * - jinak obecně nepodporováno (Firefox, starý prohlížeč, …).
 */
export function evaluateBrowserSupport(input: SupportInput): BrowserSupport {
  if (input.hasBluetooth) {
    return { supported: true };
  }
  if (isIos(input.userAgent, input.maxTouchPoints ?? 0)) {
    return { supported: false, kind: 'ios-no-bluetooth' };
  }
  return { supported: false, kind: 'unsupported' };
}

/**
 * Zjistí podporu z prohlížeče. Volat POUZE na klientovi – v SSR není `navigator`.
 * Když `navigator` chybí (SSR), vrátí „unsupported“ bez pádu.
 */
export function detectBrowserSupport(): BrowserSupport {
  if (typeof navigator === 'undefined') {
    return { supported: false, kind: 'unsupported' };
  }
  const nav = navigator as Navigator & { bluetooth?: unknown };
  return evaluateBrowserSupport({
    hasBluetooth: typeof nav.bluetooth !== 'undefined' && nav.bluetooth !== null,
    userAgent: nav.userAgent ?? '',
    maxTouchPoints: nav.maxTouchPoints ?? 0,
  });
}
