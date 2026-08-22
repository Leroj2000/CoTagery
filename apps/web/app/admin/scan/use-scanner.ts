'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Formáty, které umíme rozpoznat (QR i adoptované čárové kódy). */
const FORMATS = ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'data_matrix'];

type Detector = {
  detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]>;
};

/** Ovládání běžícího dekódování (ZXing) – umí se zastavit. */
type ScanControls = { stop: () => void };

/**
 * Sdílený scanner nad kamerou. Priorita:
 *  1) nativní `BarcodeDetector` (rychlé, Android Chrome) – když je k dispozici,
 *  2) jinak ZXing fallback (funguje i na iOS Safari / Firefox, kde BarcodeDetector chybí).
 *
 * `continuous` režim skenuje dál (workflow – víc věcí za sebou) s debounce proti
 * opakování téhož kódu; jinak se po prvním nálezu vypne (global scan – jedna věc).
 *
 * Pozn.: kamera vyžaduje HTTPS (secure context) – na https://app.tagery.tech OK.
 */
export function useBarcodeScanner(
  onDetect: (code: string) => void,
  opts?: { continuous?: boolean },
) {
  const continuous = opts?.continuous ?? false;
  const [camOn, setCamOn] = useState(false);
  const [camSupported, setCamSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const zxingRef = useRef<ScanControls | null>(null);
  const lastRef = useRef<{ code: string; t: number }>({ code: '', t: 0 });
  const onDetectRef = useRef(onDetect);
  onDetectRef.current = onDetect;

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    zxingRef.current?.stop();
    zxingRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOn(false);
  }, []);

  /** Zpracování nalezené hodnoty – sdílené pro nativní i ZXing cestu. */
  const handleValue = useCallback(
    (value: string): boolean => {
      if (!value) return false;
      const now = Date.now();
      const isRepeat = value === lastRef.current.code && now - lastRef.current.t < 1500;
      if (isRepeat) return false;
      lastRef.current = { code: value, t: now };
      onDetectRef.current(value);
      if (!continuous) {
        stop();
        return true; // signál nativní smyčce, ať skončí
      }
      return false;
    },
    [continuous, stop],
  );

  /** Nativní cesta (BarcodeDetector). */
  const startNative = useCallback(
    async (Ctor: new (o: { formats: string[] }) => Detector) => {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setCamOn(true);
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      const detector = new Ctor({ formats: FORMATS });
      const tick = async () => {
        if (!streamRef.current) return;
        try {
          const codes = await detector.detect(video);
          const stopped = handleValue(codes[0]?.rawValue ?? '');
          if (stopped) return;
        } catch {
          /* přeskoč snímek */
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    },
    [handleValue],
  );

  /** Fallback cesta (ZXing) – iOS Safari, Firefox, starší prohlížeče. */
  const startZxing = useCallback(async () => {
    const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([
      import('@zxing/browser'),
      import('@zxing/library'),
    ]);
    const hints = new Map<number, unknown>();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.QR_CODE,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.DATA_MATRIX,
    ]);
    const reader = new BrowserMultiFormatReader(hints);
    const video = videoRef.current!;
    const controls = await reader.decodeFromConstraints(
      { video: { facingMode: 'environment' } },
      video,
      (result) => {
        if (result) handleValue(result.getText());
      },
    );
    zxingRef.current = controls;
    // ZXing připojí stream na video.srcObject – převezmeme ho pro úklid (stop tracks).
    streamRef.current = (video.srcObject as MediaStream | null) ?? null;
    setCamOn(true);
  }, [handleValue]);

  const start = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamSupported(false);
      return;
    }
    const Ctor = (
      window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }
    ).BarcodeDetector;
    try {
      if (Ctor) {
        await startNative(Ctor);
      } else {
        await startZxing();
      }
    } catch {
      setError('Kameru se nepodařilo spustit (povol přístup ke kameře v prohlížeči).');
      stop();
    }
  }, [startNative, startZxing, stop]);

  useEffect(() => () => stop(), [stop]);

  return { videoRef, camOn, camSupported, error, start, stop };
}
