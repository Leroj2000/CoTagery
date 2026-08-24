import { PrinterError, type PrinterErrorKind } from './types';

/**
 * České uživatelské hlášky pro chybové/stavové situace (sekce 9 zadání).
 * Jediné místo s texty – dialog i test page je berou odsud.
 */
export const PRINTER_MESSAGES: Record<PrinterErrorKind, string> = {
  unsupported: 'Tento prohlížeč nepodporuje přímý tisk přes Bluetooth.',
  'ios-no-bluetooth': 'Pro tisk na iPhonu otevřete tuto stránku v aplikaci Bluefy.',
  cancelled: 'Výběr tiskárny byl zrušen.',
  'connection-failed':
    'K tiskárně se nepodařilo připojit. Zkontrolujte, že je zapnutá a není připojená k jinému zařízení.',
  'wrong-model': 'Připojená tiskárna není podporovaný model NIIMBOT B1.',
  disconnected: 'Spojení s tiskárnou bylo přerušeno. Připojte ji znovu.',
  'render-failed': 'Štítek se nepodařilo připravit.',
  'print-failed': 'Tisk se nezdařil. Zkontrolujte tiskárnu a zkuste to znovu.',
};

/** Hláška po úspěšném odeslání do tiskárny. */
export const PRINT_SUCCESS_MESSAGE = 'Štítek byl odeslán do tiskárny.';

/**
 * Převede libovolnou nízkoúrovňovou chybu (Web Bluetooth / knihovna) na interní
 * `PrinterError` s českou hláškou. Syrový stack/pakety se do UI nedostanou –
 * pro diagnostiku je zabalíme do `cause` a zalogujeme jinde.
 */
export function toPrinterError(err: unknown, fallback: PrinterErrorKind = 'print-failed'): PrinterError {
  if (err instanceof PrinterError) return err;

  const name = (err as { name?: string })?.name ?? '';
  const message = (err as { message?: string })?.message ?? '';
  const lower = message.toLowerCase();

  // Uživatel zavřel systémový výběr zařízení.
  if (name === 'NotFoundError' || lower.includes('user cancelled') || lower.includes('user canceled')) {
    return new PrinterError('cancelled', PRINTER_MESSAGES.cancelled, err);
  }
  // Web Bluetooth není k dispozici.
  if (lower.includes('web bluetooth') || name === 'NotSupportedError') {
    return new PrinterError('unsupported', PRINTER_MESSAGES.unsupported, err);
  }
  // Špatný model (assertSelection v knihovně: task/dpi mismatch).
  if (lower.includes('task') || lower.includes('dpi') || lower.includes('select the')) {
    return new PrinterError('wrong-model', PRINTER_MESSAGES['wrong-model'], err);
  }
  // Spadlé/přerušené spojení.
  if (
    name === 'NetworkError' ||
    lower.includes('gatt') ||
    lower.includes('disconnect') ||
    lower.includes('not connected')
  ) {
    return new PrinterError('disconnected', PRINTER_MESSAGES.disconnected, err);
  }
  return new PrinterError(fallback, PRINTER_MESSAGES[fallback], err);
}
