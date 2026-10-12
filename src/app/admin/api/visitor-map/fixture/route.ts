import { readFile } from "node:fs/promises";
import path from "node:path";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * TEMPORARY dev fixture for the visitor map demo page (/admin/visitor-map).
 * Serves tests/fixtures/visitor-map.json in the same shape as the real
 * GET /admin/api/analytics/map (getVisitorMapData). Off in production unless
 * WB_VISITOR_MAP_FIXTURE=1. Remove once real tracking data exists.
 *
 *   ?range=24h|7d|30d|90d|all  ?live=1  ?hideDc=1
 *   ?rotate=<seconds>  — `latest` moves through recent places every N seconds (to see "New visit" flights)
 */
type FixturePlace = {
  key: string;
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  lat: number;
  lng: number;
  visits: number;
  uniqueVisitors: number;
  minutesAgo: number;
  online: boolean;
  datacenter: boolean;
};

const RANGE_MINUTES: Record<string, number> = { "24h": 1440, "7d": 10080, "30d": 43200, "90d": 129600, all: Infinity };
/** Visits grow with the window so the range chips visibly change the map. */
const RANGE_SCALE: Record<string, number> = { "24h": 0.12, "7d": 0.45, "30d": 1, "90d": 2.2, all: 3.5 };

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production" && process.env.WB_VISITOR_MAP_FIXTURE !== "1") return Response.json({ error: "Not found" }, { status: 404 });
  const user = await getCurrentUser();
  if (!user || user.role !== "staff") return Response.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const range = url.searchParams.get("range") ?? "7d";
  const live = url.searchParams.get("live") === "1";
  const hideDc = url.searchParams.get("hideDc") === "1";
  const rotate = Number(url.searchParams.get("rotate") ?? 0);
  const fixture = JSON.parse(await readFile(path.join(process.cwd(), "tests/fixtures/visitor-map.json"), "utf8")) as {
    places: FixturePlace[];
    latestRotation: string[];
  };

  const now = Date.now();
  const maxMinutes = RANGE_MINUTES[range] ?? RANGE_MINUTES["7d"];
  const scale = RANGE_SCALE[range] ?? 1;
  const rows = fixture.places.filter((p) => p.minutesAgo <= maxMinutes && (!live || p.online) && (!hideDc || !p.datacenter));
  const places = rows.map((p) => ({
    key: p.key,
    city: p.city,
    region: p.region,
    country: p.country,
    countryCode: p.countryCode,
    lat: p.lat,
    lng: p.lng,
    visits: Math.max(1, Math.round(p.visits * scale)),
    uniqueVisitors: Math.max(1, Math.round(p.uniqueVisitors * scale)),
    lastSeen: new Date(now - p.minutesAgo * 60_000).toISOString(),
    online: p.online,
  }));

  const byCountry = new Map<string, { countryCode: string; country: string; visits: number; uniqueVisitors: number; lastSeen: string; online: boolean }>();
  for (const p of places) {
    if (!p.countryCode) continue;
    const c = byCountry.get(p.countryCode) ?? {
      countryCode: p.countryCode,
      country: p.country ?? p.countryCode,
      visits: 0,
      uniqueVisitors: 0,
      lastSeen: p.lastSeen,
      online: false,
    };
    c.visits += p.visits;
    c.uniqueVisitors += p.uniqueVisitors;
    if (p.lastSeen > c.lastSeen) c.lastSeen = p.lastSeen;
    c.online ||= p.online;
    byCountry.set(p.countryCode, c);
  }

  const candidates = fixture.latestRotation.map((k) => places.find((p) => p.key === k)).filter((p): p is (typeof places)[number] => !!p);
  let latest: { key: string; lat: number; lng: number; city: string | null; countryCode: string | null; at: string } | null = null;
  const pickFrom = candidates.length ? candidates : [...places].sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
  if (pickFrom.length) {
    const period = rotate > 0 ? rotate * 1000 : 0;
    const i = period ? Math.floor(now / period) % pickFrom.length : 0;
    const p = period ? pickFrom[i] : [...pickFrom].sort((a, b) => b.lastSeen.localeCompare(a.lastSeen))[0];
    // `at` must stay stable between polls, or every poll would look like a new visit.
    const bucket = period || 3_600_000;
    latest = { key: p.key, lat: p.lat, lng: p.lng, city: p.city, countryCode: p.countryCode, at: new Date(Math.floor(now / bucket) * bucket).toISOString() };
  }

  return Response.json(
    { places, countries: [...byCountry.values()].sort((a, b) => b.visits - a.visits), latest },
    { headers: { "cache-control": "no-store" } },
  );
}
