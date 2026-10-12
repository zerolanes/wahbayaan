/**
 * Pure request helpers for the consent and statistics routes: client IP,
 * shortened IP for proof-of-consent, Cloudflare location headers and a small
 * user-agent classifier. No dependencies, unit-tested.
 */

type HeaderBag = { get(name: string): string | null };

/** Client IP: Cloudflare's header when present, else the proxy chain (Railway sets X-Forwarded-For / X-Real-IP). */
export function clientIp(h: HeaderBag): string | null {
  const candidates = [h.get("cf-connecting-ip"), h.get("x-real-ip"), h.get("x-forwarded-for")?.split(",")[0]];
  for (const c of candidates) {
    const ip = c?.trim().replace(/^\[|\]$/g, "");
    if (ip && (isIPv4(ip) || isIPv6(ip))) return normalizeMappedV4(ip);
  }
  return null;
}

function normalizeMappedV4(ip: string) {
  const m = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  return m ? m[1] : ip;
}

export function isIPv4(ip: string): boolean {
  const parts = ip.split(".");
  return parts.length === 4 && parts.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}

export function isIPv6(ip: string): boolean {
  return ip.includes(":") && /^[0-9a-f:.]+$/i.test(ip) && ip.split("::").length <= 2;
}

/** Expand an IPv6 address to 8 groups (embedded IPv4 tail allowed). */
function expandV6(ip: string): string[] | null {
  let addr = ip.toLowerCase().split("%")[0];
  const v4 = addr.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) {
    if (!isIPv4(v4[1])) return null;
    const [a, b, c, d] = v4[1].split(".").map(Number);
    addr = addr.slice(0, -v4[1].length) + ((a << 8) | b).toString(16) + ":" + ((c << 8) | d).toString(16);
  }
  const [head, tail] = addr.split("::");
  const h = head ? head.split(":") : [];
  const t = tail !== undefined ? (tail ? tail.split(":") : []) : [];
  const fill = addr.includes("::") ? 8 - h.length - t.length : 0;
  const groups = [...h, ...Array(Math.max(0, fill)).fill("0"), ...t];
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map((g) => g.replace(/^0+(?=.)/, ""));
}

/**
 * Proof-of-consent IP: IPv4 with the last octet zeroed (203.0.113.0),
 * IPv6 truncated to its /48 prefix (2001:db8:1::). Invalid input → null.
 */
export function shortenIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const clean = normalizeMappedV4(ip.trim().replace(/^\[|\]$/g, ""));
  if (isIPv4(clean)) {
    const p = clean.split(".");
    return `${Number(p[0])}.${Number(p[1])}.${Number(p[2])}.0`;
  }
  if (isIPv6(clean)) {
    const g = expandV6(clean);
    if (!g) return null;
    return `${g[0]}:${g[1]}:${g[2]}::`;
  }
  return null;
}

/** Loopback, private, link-local and documentation ranges are never sent to a location provider. */
export function isPrivateIp(ip: string): boolean {
  if (isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const l = ip.toLowerCase();
  return l === "::1" || l === "::" || l.startsWith("fe80:") || l.startsWith("fc") || l.startsWith("fd");
}

export type GeoData = {
  countryCode: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  isDatacenter: boolean;
};

export function countryName(code: string | null | undefined): string | null {
  if (!code || !/^[A-Z]{2}$/i.test(code)) return null;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? null;
  } catch {
    return null;
  }
}

const num = (v: string | null | undefined) => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Cloudflare visitor-location headers (cf-ipcountry is always sent; city/region/lat/lng need the "visitor location headers" managed transform). */
export function cloudflareGeo(h: HeaderBag): GeoData | null {
  const cc = h.get("cf-ipcountry")?.toUpperCase();
  if (!cc || cc === "XX" || cc === "T1" || !/^[A-Z]{2}$/.test(cc)) return null;
  const decode = (v: string | null) => {
    if (!v) return null;
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  };
  const lat = num(h.get("cf-iplatitude"));
  const lng = num(h.get("cf-iplongitude"));
  return {
    countryCode: cc,
    country: countryName(cc),
    region: decode(h.get("cf-region")),
    city: decode(h.get("cf-ipcity")),
    latitude: lat,
    longitude: lng,
    isDatacenter: false,
  };
}

const DATACENTER_ORG =
  /amazon|aws|google cloud|google llc|microsoft|azure|digitalocean|linode|akamai|hetzner|ovh|vultr|oracle|alibaba|tencent|scaleway|contabo|leaseweb|choopa|m247|datacamp|cdn77|fastly|cloudflare|hosting|server|data ?cent|colo|vps/i;

export function looksLikeDatacenter(org: string | null | undefined): boolean {
  return !!org && DATACENTER_ORG.test(org);
}

export type UaInfo = { device: "mobile" | "tablet" | "desktop"; browser: string; os: string };

export function parseUserAgent(ua: string | null | undefined): UaInfo {
  const s = ua ?? "";
  const os = /windows nt/i.test(s)
    ? "Windows"
    : /iphone|ipad|ipod/i.test(s)
      ? "iOS"
      : /android/i.test(s)
        ? "Android"
        : /mac os x|macintosh/i.test(s)
          ? "macOS"
          : /cros/i.test(s)
            ? "ChromeOS"
            : /linux/i.test(s)
              ? "Linux"
              : "Other";
  const browser = /edg(e|a|ios)?\//i.test(s)
    ? "Edge"
    : /opr\/|opera/i.test(s)
      ? "Opera"
      : /samsungbrowser/i.test(s)
        ? "Samsung Internet"
        : /firefox|fxios/i.test(s)
          ? "Firefox"
          : /chrome|crios|chromium/i.test(s)
            ? "Chrome"
            : /safari/i.test(s)
              ? "Safari"
              : "Other";
  const device = /ipad|tablet|(android(?!.*mobile))/i.test(s) ? "tablet" : /mobi|iphone|ipod|android/i.test(s) ? "mobile" : "desktop";
  return { device, browser, os };
}

/** Keep stored strings short and printable. */
export function clip(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const s = v.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return s ? s.slice(0, max) : null;
}

/** Path only (no query string, which can carry emails or tokens), clipped. */
export function cleanPath(v: unknown): string | null {
  const s = clip(v, 500);
  if (!s || !s.startsWith("/") || s.startsWith("//")) return null;
  return s.split(/[?#]/)[0] || "/";
}

/** External referrer reduced to origin + path (no query); same-site referrers become paths. */
export function cleanReferrer(v: unknown, ownHost: string | null): string | null {
  const s = clip(v, 1000);
  if (!s) return null;
  if (s.startsWith("/")) return cleanPath(s);
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (ownHost && u.host === ownHost) return u.pathname || "/";
    return `${u.origin}${u.pathname === "/" ? "" : u.pathname}`.slice(0, 500);
  } catch {
    return null;
  }
}
