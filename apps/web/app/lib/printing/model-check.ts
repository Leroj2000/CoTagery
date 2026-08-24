import { NIIMBOT_B1_MODEL } from './niimbot-config';

/** Identifikace vrácená knihovnou po připojení (podmnožina). */
export type IdentifiedPrinter = {
  task: string | null;
  dpi: number | null;
  label?: string;
};

/**
 * Ověří, že identifikovaná tiskárna je podporovaný NIIMBOT B1 (task „b1“,
 * 203 DPI). Odmítne B1 Pro (task „v4“, 300 DPI) i jiné modely. Neznámé pole
 * (`null`) se nebere jako důvod k odmítnutí – knihovna může vrátit částečná data.
 *
 * Čistá funkce – používá ji klient i testy.
 */
export function isSupportedB1(info: IdentifiedPrinter): boolean {
  if (info.task != null && info.task !== NIIMBOT_B1_MODEL.task) return false;
  if (info.dpi != null && info.dpi !== NIIMBOT_B1_MODEL.dpi) return false;
  return true;
}
