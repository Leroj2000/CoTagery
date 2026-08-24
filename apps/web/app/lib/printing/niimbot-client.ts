import { LABEL_50X30, NIIMBOT_B1_MODEL } from './niimbot-config';
import { isSupportedB1 } from './model-check';
import { toPrinterError } from './printer-messages';
import { PrinterError, type LabelData, type PrinterInfo } from './types';
import { renderLabel } from './render-label';

/**
 * Klientský wrapper nad knihovnou `niimbot-web-bluetooth`. Integrace je záměrně
 * izolovaná (sekce 3/5 zadání), aby ji šlo později vyměnit za oficiální SDK.
 *
 * Knihovna je zero-dependency CommonJS modul, který se při načtení navěsí jako
 * `Niimbot` na `globalThis`/`window` (žádný ESM default export). Proto ji sem
 * načítáme dynamicky POUZE na klientovi a pracujeme s globálem. Během SSR se sem
 * vůbec nesmí sáhnout.
 */

/** Podmnožina API `Niimbot`, kterou používáme (viz čtení zdrojů verze 2.4.0). */
type NiimbotModel = {
  name_prefixes: readonly string[];
  task: string;
  density: number;
  label_type: number;
  speed: number;
};
type NiimbotSize = { w_px: number; h_px: number; dpi?: number; offset_y_px?: number };
type NiimbotPrinterInfo = {
  modelId: number | null;
  protocolVersion: number | null;
  deviceName: string | null;
  label: string;
  task: string | null;
  dpi: number | null;
};
type PrintOpts = {
  model: NiimbotModel;
  size: NiimbotSize;
  copies?: number;
  density?: number;
  onProgress?: (s: string) => void;
};

type NiimbotApi = {
  VERSION: string;
  DEBUG: boolean;
  isSupported: () => boolean;
  identify: (model: NiimbotModel) => Promise<NiimbotPrinterInfo>;
  connect: (model: NiimbotModel) => Promise<void>;
  disconnect: () => Promise<void>;
  printImage: (url: string, opts: PrintOpts) => Promise<void>;
  printBatch: (urls: string[], opts: PrintOpts) => Promise<void>;
  readonly printer: NiimbotPrinterInfo | null;
};

let cached: NiimbotApi | null = null;

/** Dynamicky načte knihovnu a vrátí globální `Niimbot` API (jen na klientovi). */
async function loadNiimbot(): Promise<NiimbotApi> {
  if (typeof window === 'undefined') {
    throw new PrinterError('unsupported', 'Tisk je dostupný pouze v prohlížeči.');
  }
  if (cached) return cached;
  // Import kvůli vedlejšímu efektu – modul navěsí `Niimbot` na globalThis/window.
  await import('niimbot-web-bluetooth');
  const api = (globalThis as unknown as { Niimbot?: NiimbotApi }).Niimbot;
  if (!api) {
    throw new PrinterError('unsupported', 'Tiskovou knihovnu se nepodařilo načíst.');
  }
  cached = api;
  return api;
}

/** Zapne/vypne diagnostický režim knihovny (jen pro vývoj / test page). */
export async function setDebug(enabled: boolean): Promise<void> {
  const api = await loadNiimbot();
  api.DEBUG = enabled;
}

function toPrinterInfo(info: NiimbotPrinterInfo): PrinterInfo {
  return {
    modelId: info.modelId,
    label: info.label,
    deviceName: info.deviceName,
    task: info.task,
    dpi: info.dpi,
  };
}

const MODEL: NiimbotModel = {
  name_prefixes: NIIMBOT_B1_MODEL.name_prefixes,
  task: NIIMBOT_B1_MODEL.task,
  density: NIIMBOT_B1_MODEL.density,
  label_type: NIIMBOT_B1_MODEL.label_type,
  speed: NIIMBOT_B1_MODEL.speed,
};

const SIZE: NiimbotSize = {
  w_px: LABEL_50X30.w_px,
  h_px: LABEL_50X30.h_px,
  dpi: LABEL_50X30.dpi,
  offset_y_px: LABEL_50X30.offset_y_px,
};

/**
 * Vyvolá výběr tiskárny (přímou akcí uživatele), připojí ji a identifikuje.
 * Když nejde o podporovaný B1, hned se odpojí a vyhodí `wrong-model`.
 */
export async function connectPrinter(): Promise<PrinterInfo> {
  const api = await loadNiimbot();
  if (!api.isSupported()) {
    throw new PrinterError('unsupported', 'Tento prohlížeč nepodporuje přímý tisk přes Bluetooth.');
  }
  let info: NiimbotPrinterInfo;
  try {
    info = await api.identify(MODEL);
  } catch (err) {
    throw toPrinterError(err, 'connection-failed');
  }
  if (!isSupportedB1(info)) {
    // Odmítni B1 Pro nebo jinou tiskárnu; ukliď spojení.
    try {
      await api.disconnect();
    } catch {
      /* diagnostika není pro uživatele podstatná */
    }
    throw new PrinterError('wrong-model', 'Připojená tiskárna není podporovaný model NIIMBOT B1.');
  }
  return toPrinterInfo(info);
}

/** Odpojí tiskárnu (pro test page / úklid). */
export async function disconnectPrinter(): Promise<void> {
  if (!cached) return;
  try {
    await cached.disconnect();
  } catch {
    /* ignoruj – jde jen o úklid */
  }
}

/**
 * Vykreslí štítek a odešle ho do tiskárny v `copies` identických kopiích.
 * Obraz se odesílá JEDNOU s parametrem `copies` (neposílá se opakovaně).
 * Object URL se po dotištění vždy uvolní.
 */
export async function printLabel(
  data: LabelData,
  copies: number,
  onProgress?: (s: string) => void,
): Promise<void> {
  const api = await loadNiimbot();
  const rendered = await renderLabel(data);
  try {
    await api.printImage(rendered.url, {
      model: MODEL,
      size: SIZE,
      copies,
      density: NIIMBOT_B1_MODEL.density,
      onProgress,
    });
  } catch (err) {
    throw toPrinterError(err, 'print-failed');
  } finally {
    rendered.revoke();
  }
}

/** Verze načtené knihovny (pro diagnostiku na test page). */
export async function getLibraryVersion(): Promise<string> {
  const api = await loadNiimbot();
  return api.VERSION;
}
