import "server-only";
import { and, desc, eq, gte, isNotNull, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { analyticsVisits } from "@/lib/db/schema";
import { LIVE_WINDOW_MS } from "./stats";

/**
 * Data for the visitor map (built separately; mounted on the Statistics and
 * Live now screens). Aggregates stored visits by place and by country.
 * `online` = a heartbeat or page view within the last 2 minutes.
 */
export type MapRange = "24h" | "7d" | "30d" | "90d" | "all";
export const MAP_RANGES: readonly MapRange[] = ["24h", "7d", "30d", "90d", "all"];

export type VisitorMapPlace = {
  key: string;
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  lat: number;
  lng: number;
  visits: number;
  uniqueVisitors: number;
  lastSeen: string;
  online: boolean;
};
export type VisitorMapCountry = { countryCode: string; country: string; visits: number; uniqueVisitors: number; lastSeen: string; online: boolean };
export type VisitorMapData = {
  places: VisitorMapPlace[];
  countries: VisitorMapCountry[];
  latest: { key: string; lat: number; lng: number; city: string | null; countryCode: string | null; at: string } | null;
};

const RANGE_MS: Record<Exclude<MapRange, "all">, number> = { "24h": 86_400_000, "7d": 7 * 86_400_000, "30d": 30 * 86_400_000, "90d": 90 * 86_400_000 };

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString());
const round = (v: number) => Math.round(v * 100) / 100;

export function placeKey(p: { countryCode: string | null; region: string | null; city: string | null; lat: number; lng: number }) {
  return [p.countryCode ?? "", p.region ?? "", p.city ?? "", round(p.lat).toFixed(2), round(p.lng).toFixed(2)].join("|");
}

export async function getVisitorMapData({ range, liveOnly = false, hideDatacenter = false }: { range: MapRange; liveOnly?: boolean; hideDatacenter?: boolean }, now = new Date()): Promise<VisitorMapData> {
  const d = await db();
  const onlineSince = new Date(now.getTime() - LIVE_WINDOW_MS);
  const where: SQL[] = [];
  if (liveOnly) where.push(gte(analyticsVisits.lastSeenAt, onlineSince));
  else if (range !== "all") where.push(gte(analyticsVisits.lastSeenAt, new Date(now.getTime() - RANGE_MS[range])));
  if (hideDatacenter) where.push(eq(analyticsVisits.isDatacenter, false));

  const lat = sql<number>`round(${analyticsVisits.latitude}::numeric, 2)::float8`;
  const lng = sql<number>`round(${analyticsVisits.longitude}::numeric, 2)::float8`;
  const lastSeen = sql<Date>`max(${analyticsVisits.lastSeenAt})`;
  const visits = sql<number>`count(*)::int`;
  const unique = sql<number>`count(distinct ${analyticsVisits.consentId})::int`;

  const [placeRows, countryRows, latestRows] = await Promise.all([
    d
      .select({ countryCode: analyticsVisits.countryCode, country: analyticsVisits.country, region: analyticsVisits.region, city: analyticsVisits.city, lat, lng, visits, unique, lastSeen })
      .from(analyticsVisits)
      .where(and(...where, isNotNull(analyticsVisits.latitude), isNotNull(analyticsVisits.longitude)))
      .groupBy(analyticsVisits.countryCode, analyticsVisits.country, analyticsVisits.region, analyticsVisits.city, lat, lng)
      .orderBy(desc(visits))
      .limit(2000),
    d
      .select({ countryCode: analyticsVisits.countryCode, country: sql<string | null>`max(${analyticsVisits.country})`, visits, unique, lastSeen })
      .from(analyticsVisits)
      .where(and(...where, isNotNull(analyticsVisits.countryCode)))
      .groupBy(analyticsVisits.countryCode)
      .orderBy(desc(visits)),
    d
      .select({ countryCode: analyticsVisits.countryCode, region: analyticsVisits.region, city: analyticsVisits.city, latitude: analyticsVisits.latitude, longitude: analyticsVisits.longitude, at: analyticsVisits.lastSeenAt })
      .from(analyticsVisits)
      .where(and(...where, isNotNull(analyticsVisits.latitude), isNotNull(analyticsVisits.longitude)))
      .orderBy(desc(analyticsVisits.lastSeenAt))
      .limit(1),
  ]);

  const places: VisitorMapPlace[] = placeRows.map((r) => {
    const seen = iso(r.lastSeen);
    const p = { countryCode: r.countryCode, region: r.region, city: r.city, lat: Number(r.lat), lng: Number(r.lng) };
    return {
      key: placeKey(p),
      city: r.city,
      region: r.region,
      country: r.country,
      countryCode: r.countryCode,
      lat: p.lat,
      lng: p.lng,
      visits: Number(r.visits),
      uniqueVisitors: Number(r.unique),
      lastSeen: seen,
      online: new Date(seen) >= onlineSince,
    };
  });
  const countries: VisitorMapCountry[] = countryRows.map((r) => {
    const seen = iso(r.lastSeen);
    return {
      countryCode: r.countryCode!,
      country: r.country ?? r.countryCode!,
      visits: Number(r.visits),
      uniqueVisitors: Number(r.unique),
      lastSeen: seen,
      online: new Date(seen) >= onlineSince,
    };
  });
  const l = latestRows[0];
  const latest = l
    ? (() => {
        const p = { countryCode: l.countryCode, region: l.region, city: l.city, lat: round(l.latitude!), lng: round(l.longitude!) };
        return { key: placeKey(p), lat: p.lat, lng: p.lng, city: l.city, countryCode: l.countryCode, at: l.at.toISOString() };
      })()
    : null;
  return { places, countries, latest };
}
