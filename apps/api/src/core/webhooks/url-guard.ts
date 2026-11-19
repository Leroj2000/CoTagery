import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * SSRF ochrana odchozích webhooků (MVP M3, BACKLOG SEC-01).
 *
 * Tenant si URL zadává sám, takže API nesmí posílat požadavky do vnitřní sítě
 * (Postgres, Redis, n8n, metadata služby cloudu, localhost). Pravidla:
 * - jen `http:`/`https:` bez přihlašovacích údajů v URL; v produkci jen `https:`,
 * - všechny adresy, na které se host přeloží, musí být veřejné (IPv4 i IPv6),
 * - výjimky pro vědomě interní cíle přes `WEBHOOK_ALLOWED_HOSTS` (čárkou oddělené hostname).
 *
 * Pozn.: kontrola probíhá při registraci i těsně před každým doručením a doručení
 * nesleduje přesměrování; zbytkové riziko DNS rebindingu mezi lookupem a fetchem
 * je u krátkého okna akceptované a popsané v BACKLOG.
 */
export type LookupFn = (host: string) => Promise<string[]>;

export interface UrlGuardOptions {
  production: boolean;
  allowedHosts?: string[];
  lookup?: LookupFn;
}

export class UnsafeUrlError extends Error {}

const defaultLookup: LookupFn = async (host) =>
  (await dnsLookup(host, { all: true, verbatim: true })).map((a) => a.address);

export function parseAllowedHosts(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

const BLOCKED_V4: Array<[string, number]> = [
  ['0.0.0.0', 8], // „tato“ síť
  ['10.0.0.0', 8], // privátní
  ['100.64.0.0', 10], // CGNAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local + cloud metadata
  ['172.16.0.0', 12], // privátní (Docker sítě)
  ['192.0.0.0', 24], // IETF
  ['192.0.2.0', 24], // dokumentace
  ['192.168.0.0', 16], // privátní
  ['198.18.0.0', 15], // benchmark
  ['198.51.100.0', 24], // dokumentace
  ['203.0.113.0', 24], // dokumentace
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // rezervováno + broadcast
];

export function isPrivateIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  return BLOCKED_V4.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (n & mask) === (ipv4ToInt(base) & mask);
  });
}

export function isPrivateIPv6(ip: string): boolean {
  const a = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (a === '::' || a === '::1') return true;
  // IPv4-mapped / IPv4-compatible (::ffff:10.0.0.1)
  const mapped = a.match(/^(?:0*:)*(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIPv4(mapped[1]);
  // ::ffff:7f00:1 (hex forma)
  const hexMapped = a.match(/^(?:0*:)*ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hexMapped) {
    const hi = parseInt(hexMapped[1], 16);
    const lo = parseInt(hexMapped[2], 16);
    return isPrivateIPv4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  const first = parseInt(a.split(':')[0] || '0', 16);
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 ULA
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((first & 0xff00) === 0xff00) return true; // multicast
  if (a.startsWith('64:ff9b:')) return true; // NAT64 – může mířit dovnitř
  if (a.startsWith('2001:db8:')) return true; // dokumentace
  return false;
}

export function isPrivateAddress(ip: string): boolean {
  const kind = isIP(ip.replace(/^\[|\]$/g, ''));
  if (kind === 4) return isPrivateIPv4(ip);
  if (kind === 6) return isPrivateIPv6(ip);
  return true; // neznámý formát = neriskovat
}

/** Vrátí normalizovanou URL, nebo vyhodí `UnsafeUrlError` s českým důvodem. */
export async function assertSafeWebhookUrl(raw: string, opts: UrlGuardOptions): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError('Neplatná URL');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new UnsafeUrlError('Povolené jsou jen adresy http(s)');
  }
  if (url.username || url.password) {
    throw new UnsafeUrlError('URL nesmí obsahovat přihlašovací údaje');
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const allowed = (opts.allowedHosts ?? []).includes(host);
  if (allowed) return url;

  if (opts.production && url.protocol !== 'https:') {
    throw new UnsafeUrlError('V produkci jsou povolené jen adresy https');
  }
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
    throw new UnsafeUrlError('Adresa míří do vnitřní sítě');
  }
  const addresses = isIP(host) ? [host] : await (opts.lookup ?? defaultLookup)(host).catch(() => {
    throw new UnsafeUrlError('Host webhooku nelze přeložit (DNS)');
  });
  if (addresses.length === 0) throw new UnsafeUrlError('Host webhooku nelze přeložit (DNS)');
  if (addresses.some(isPrivateAddress)) {
    throw new UnsafeUrlError('Adresa míří do vnitřní sítě');
  }
  return url;
}
