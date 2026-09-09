/** One-shot acquisition. Denial, timeout and unsupported browsers keep scanning usable. */
export function captureScanPosition(onUnavailable?: (reason: string) => void): Promise<
  | {
      latitude: number;
      longitude: number;
      accuracyMeters: number;
      capturedAt: string;
      source: 'device';
    }
  | undefined
> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      onUnavailable?.('Tento prohlížeč neposkytuje polohu.');
      return resolve(undefined);
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords, timestamp }) =>
        resolve({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracyMeters: coords.accuracy,
          capturedAt: new Date(timestamp).toISOString(),
          source: 'device',
        }),
      (error) => {
        onUnavailable?.(
          error.code === 1
            ? 'Přístup k poloze je zablokovaný. Povolte jej v nastavení prohlížeče, nebo polohu zadejte ručně.'
            : error.code === 3
              ? 'Polohu se nepodařilo zjistit včas.'
              : 'Zařízení nyní nedokáže určit polohu.',
        );
        resolve(undefined);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
    );
  });
}
