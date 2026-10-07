interface NominatimAddress {
  house_number?: string;
  road?: string;
  pedestrian?: string;
  footway?: string;
  cycleway?: string;
  path?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  postcode?: string;
}

interface NominatimResult {
  display_name?: string;
  address?: NominatimAddress;
}

let requestQueue: Promise<void> = Promise.resolve();
let lastRequestAt = 0;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Krátký český popis: nejbližší ulice + číslo a obec, pokud je provider zná. */
export function formatReverseAddress(result: NominatimResult): string | null {
  const address = result.address ?? {};
  const street =
    address.road ?? address.pedestrian ?? address.footway ?? address.cycleway ?? address.path;
  const locality =
    address.city ??
    address.town ??
    address.village ??
    address.municipality ??
    address.suburb ??
    address.neighbourhood;
  const streetLine = street
    ? `${street}${address.house_number ? ` ${address.house_number}` : ''}`
    : null;
  const localityLine = [address.postcode, locality].filter(Boolean).join(' ');
  const concise = [streetLine, localityLine].filter(Boolean).join(', ');
  if (concise) return concise;

  const fallback = result.display_name?.trim();
  return fallback ? fallback.split(',').slice(0, 3).join(',').trim() : null;
}

/**
 * Reverzní geokódování přes konfigurovatelný Nominatim-kompatibilní endpoint.
 * Fronta drží veřejný endpoint pod limitem jednoho požadavku za sekundu.
 */
export function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  const task = requestQueue.then(async () => {
    const elapsed = Date.now() - lastRequestAt;
    if (elapsed < 1_000) await wait(1_000 - elapsed);
    lastRequestAt = Date.now();

    const endpoint =
      process.env.GEOCODING_REVERSE_URL ?? 'https://nominatim.openstreetmap.org/reverse';
    const url = new URL(endpoint);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('lat', String(latitude));
    url.searchParams.set('lon', String(longitude));
    url.searchParams.set('zoom', '18');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('layer', 'address');
    url.searchParams.set('accept-language', 'cs,en');

    const response = await fetch(url, {
      headers: {
        'user-agent': process.env.GEOCODING_USER_AGENT ?? 'Tagery/0.1',
        accept: 'application/json',
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`Reverse geocoding selhal (${response.status})`);
    return formatReverseAddress((await response.json()) as NominatimResult);
  });

  requestQueue = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}
