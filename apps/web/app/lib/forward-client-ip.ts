/**
 * Forward client IP from the incoming browser request when the BFF calls Nest.
 * Nest trusts private/loopback proxies (`trust proxy`), so X-Forwarded-For /
 * X-Real-IP make req.ip (and per-IP rate limits) the real client, not the web container.
 */

export type HeaderSource = { get(name: string): string | null };

/** First hop from X-Forwarded-For, else X-Real-IP, else unknown. */
export function clientIpFromHeaders(h: HeaderSource): string {
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = h.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

/**
 * Headers to attach on BFF → API fetches. Reuses existing XFF chain when present
 * (Caddy → web); otherwise sets the derived client IP. Does not invent new names.
 */
export function apiForwardHeaders(incoming: HeaderSource): Record<string, string> {
  const clientIp = clientIpFromHeaders(incoming);
  const existingXff = incoming.get("x-forwarded-for")?.trim();
  const out: Record<string, string> = {
    "x-forwarded-for": existingXff || clientIp,
    "x-real-ip": incoming.get("x-real-ip")?.trim() || clientIp,
  };
  const forwarded = incoming.get("forwarded")?.trim();
  if (forwarded) {
    out.forwarded = forwarded;
  } else if (clientIp !== "unknown") {
    out.forwarded = `for=${clientIp.includes(":") && !clientIp.startsWith("[") ? `"[${clientIp}]"` : clientIp}`;
  }
  return out;
}
