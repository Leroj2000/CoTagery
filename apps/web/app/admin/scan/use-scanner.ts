'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** Formáty, které umí BarcodeDetector rozpoznat (QR i adoptované čárové kódy). */
const FORMATS = ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'data_matrix'];

type Detector = {
  detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]>;
};

/**
 * Sdílený scanner nad nativním BarcodeDetector (kamera). `continuous` režim
 * skenuje dál (workflow – víc věcí za sebou) s debounce proti opakování téhož
 * kódu; jinak se po prvním nálezu vypne (global scan – jedna věc).
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
  const lastRef = useRef<{ code: string; t: number }>({ code: '', t: 0 });
  const onDetectRef = useRef(onDetect);
  onDetectRef.current = onDetect;

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOn(false);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    const Ctor = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector })
      .BarcodeDetector;
    if (!Ctor) {
      setCamSupported(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
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
          const value = codes[0]?.rawValue;
          if (value) {
            const now = Date.now();
            const isRepeat = value === lastRef.current.code && now - lastRef.current.t < 1500;
            if (!isRepeat) {
              lastRef.current = { code: value, t: now };
              onDetectRef.current(value);
              if (!continuous) {
                stop();
                return;
              }
            }
          }
        } catch {
          /* přeskoč snímek */
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setError('Kameru se nepodařilo spustit (oprávnění / HTTPS).');
      stop();
    }
  }, [continuous, stop]);

  useEffect(() => () => stop(), [stop]);

  return { videoRef, camOn, camSupported, error, start, stop };
}
