/**
 * Datový kontrakt a typy pro tisk štítků na NIIMBOT B1.
 *
 * Tato vrstva je záměrně nezávislá na databázovém modelu projektu. Napojení na
 * konkrétní `Asset`/`DataCarrier` se dělá v rodičovské komponentě (adaptéru),
 * nikoliv uvnitř vykreslovací funkce – viz sekce 6 zadání.
 */

/** Vstupní data pro jeden štítek. Nezávislé na modelu databáze. */
export type LabelData = {
  /** Hodnota zakódovaná do QR (typicky resolver URL nosiče). */
  qrValue: string;
  /** Název položky (může být delší – renderer ho zalomí a případně zkrátí). */
  itemName: string;
  /** Evidenční kód (inventární číslo nebo public code nosiče). */
  assetCode: string;
  /** Kategorie položky (buňka „Kategorie“ v šabloně štítku). */
  category?: string;
  /** Umístění položky (buňka „Umístění“ v šabloně štítku). */
  location?: string;
  /**
   * URL loga do středu QR. `undefined` = logo aktuální firmy (BFF proxy),
   * `null` = bez loga. Když logo neexistuje (404), QR se vykreslí bez něj.
   */
  logoUrl?: string | null;
};

/** Stavový automat tiskárny (viz sekce 5 zadání). */
export type PrinterState =
  | 'unsupported'
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'rendering'
  | 'printing'
  | 'success'
  | 'error';

/** Identifikace připojené tiskárny (podmnožina `Niimbot.printer`). */
export type PrinterInfo = {
  modelId: number | null;
  /** Popisný název modelu, např. „Niimbot B1“. */
  label: string;
  /** Advertised BLE jméno (např. „B1-…“). */
  deviceName: string | null;
  /** Varianta tiskové úlohy: „b1“ pro B1, „v4“ pro B1 Pro apod. */
  task: string | null;
  /** Rozlišení tiskárny v DPI. */
  dpi: number | null;
};

/** Kategorie chyby – mapuje se na uživatelskou českou hlášku. */
export type PrinterErrorKind =
  | 'unsupported'
  | 'ios-no-bluetooth'
  | 'cancelled'
  | 'connection-failed'
  | 'wrong-model'
  | 'disconnected'
  | 'render-failed'
  | 'print-failed';

/** Interní typ chyby s uživatelsky čitelnou (českou) zprávou. */
export class PrinterError extends Error {
  readonly kind: PrinterErrorKind;
  /** Původní nízkoúrovňová chyba pro diagnostiku (nezobrazuje se uživateli). */
  readonly cause?: unknown;

  constructor(kind: PrinterErrorKind, message: string, cause?: unknown) {
    super(message);
    this.name = 'PrinterError';
    this.kind = kind;
    this.cause = cause;
  }
}

/** Podpora prostředí zjištěná z `navigator`/UA (informativní, ne náhrada za skutečnou chybu). */
export type BrowserSupport =
  { supported: true } | { supported: false; kind: 'ios-no-bluetooth' | 'unsupported' };
