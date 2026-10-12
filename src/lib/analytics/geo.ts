import "server-only";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { ipGeoCache } from "@/lib/db/schema";
import { getSetting } from "@/lib/settings";
import { countryName, isPrivateIp, looksLikeDatacenter, type GeoData } from "./request-info";
import type { GeoProvider } from "./settings-shape";

/**
 * IP → approximate location through the provider chosen in Admin → Privacy
 * settings. Results are cached for 24 hours per IP (in memory and in
 * `ip_geo_cache`, keyed by a salted hash — the IP itself is never stored).
 * Always called from `after()`, so a slow provider never delays a response.
 */
const DAY = 86_400_000;
const memory = new Map<string, { at: number; data: GeoData | null }>();

export function ipHash(ip: string) {
  return crypto
    .createHash("sha256")
    .update(`${process.env.AUTH_SECRET ?? "wahbayaan"}|geo|${ip}`)
    .digest("hex");
}

export async function apiKeys() {
  const stored = await getSetting("analytics_secrets");
  return {
    ipinfoToken: stored.ipinfoToken || process.env.IPINFO_TOKEN || null,
    ip2locationKey: stored.ip2locationKey || process.env.IP2LOCATION_KEY || null,
  };
}

export async function lookupGeo(ip: string, provider: GeoProvider): Promise<GeoData | null> {
  if (provider === "off" || isPrivateIp(ip)) return null;
  const key = ipHash(ip);
  const now = Date.now();
  const mem = memory.get(key);
  if (mem && now - mem.at < DAY) return mem.data;
  const d = await db();
  const [row] = await d.select().from(ipGeoCache).where(eq(ipGeoCache.ipHash, key)).limit(1);
  if (row && now - row.fetchedAt.getTime() < DAY) {
    const data = (row.data as { geo?: GeoData | null }).geo ?? null;
    remember(key, data);
    return data;
  }
  let data: GeoData | null = null;
  try {
    data = await fetchProvider(ip, provider, await apiKeys());
  } catch (err) {
    console.warn("[analytics] location lookup failed:", err instanceof Error ? err.message : err);
    return null; // not cached: try again on the next visit
  }
  remember(key, data);
  await d
    .insert(ipGeoCache)
    .values({ ipHash: key, data: { geo: data, provider }, fetchedAt: new Date() })
    .onConflictDoUpdate({ target: ipGeoCache.ipHash, set: { data: { geo: data, provider }, fetchedAt: new Date() } });
  return data;
}

function remember(key: string, data: GeoData | null) {
  if (memory.size > 5000) memory.clear();
  memory.set(key, { at: Date.now(), data });
}

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);
const s = (v: unknown) => (typeof v === "string" && v.trim() && v !== "-" ? v.trim().slice(0, 120) : null);

async function getJson(url: string): Promise<Record<string, unknown>> {
  const res = await fetch(url, { headers: { accept: "application/json", "user-agent": "wahbayaan-analytics/1" }, signal: AbortSignal.timeout(4000), cache: "no-store" });
  if (res.status === 429) throw new Error("rate limited by provider");
  if (!res.ok) throw new Error(`provider HTTP ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

export async function fetchProvider(ip: string, provider: GeoProvider, keys: { ipinfoToken: string | null; ip2locationKey: string | null }): Promise<GeoData | null> {
  const enc = encodeURIComponent(ip);
  if (provider === "ipapi") {
    const j = await getJson(`https://ipapi.co/${enc}/json/`);
    if (j.error) {
      if (j.reserved) return null;
      throw new Error(String(j.reason ?? "ipapi error"));
    }
    const cc = s(j.country_code)?.toUpperCase() ?? null;
    return { countryCode: cc, country: s(j.country_name) ?? countryName(cc), region: s(j.region), city: s(j.city), latitude: n(j.latitude), longitude: n(j.longitude), isDatacenter: looksLikeDatacenter(s(j.org)) };
  }
  if (provider === "ipinfo") {
    if (!keys.ipinfoToken) return null;
    const j = await getJson(`https://ipinfo.io/${enc}/json?token=${encodeURIComponent(keys.ipinfoToken)}`);
    if (j.bogon) return null;
    const [lat, lng] = (s(j.loc) ?? "").split(",").map((x) => n(x));
    const cc = s(j.country)?.toUpperCase() ?? null;
    const privacy = (j.privacy ?? {}) as Record<string, unknown>;
    return {
      countryCode: cc,
      country: countryName(cc),
      region: s(j.region),
      city: s(j.city),
      latitude: lat ?? null,
      longitude: lng ?? null,
      isDatacenter: privacy.hosting === true || looksLikeDatacenter(s(j.org)),
    };
  }
  if (provider === "ip2location") {
    if (!keys.ip2locationKey) return null;
    const j = await getJson(`https://api.ip2location.io/?key=${encodeURIComponent(keys.ip2locationKey)}&ip=${enc}&format=json`);
    if (j.error) throw new Error(String((j.error as { error_message?: string }).error_message ?? "ip2location error"));
    const cc = s(j.country_code)?.toUpperCase() ?? null;
    return {
      countryCode: cc,
      country: s(j.country_name) ?? countryName(cc),
      region: s(j.region_name),
      city: s(j.city_name),
      latitude: n(j.latitude),
      longitude: n(j.longitude),
      isDatacenter: j.is_proxy === true || looksLikeDatacenter(s(j.as)),
    };
  }
  return null;
}
