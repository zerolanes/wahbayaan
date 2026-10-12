/**
 * Visitor statistics against a throwaway embedded Postgres: page views and
 * heartbeats, the retention cleanup (age, page-view cap, consent records,
 * location cache), the once-a-day self-scheduled cleanup and the map data.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wb-analytics-"));
process.env.PGLITE_DIR = path.join(dir, "db");
process.env.DATABASE_URL = "";

type Mods = {
  connect: typeof import("@/lib/db/connect");
  t: typeof import("@/lib/db/schema");
  store: typeof import("@/lib/analytics/store");
  map: typeof import("@/lib/analytics/map-data");
  settings: typeof import("@/lib/settings");
};
let m: Mods;
const DAY = 86_400_000;

beforeAll(async () => {
  m = {
    connect: await import("@/lib/db/connect"),
    t: await import("@/lib/db/schema"),
    store: await import("@/lib/analytics/store"),
    map: await import("@/lib/analytics/map-data"),
    settings: await import("@/lib/settings"),
  };
  await m.settings.setSetting("analytics", { consentRev: 1, geoProvider: "off", retentionDays: 90, maxPageViews: 1000, consentRetentionDays: 1095 });
});

afterAll(async () => {
  await m.connect.closeDb();
  fs.rmSync(dir, { recursive: true, force: true });
});

const pv = (visitKey: string, p: string, extra: Partial<Parameters<Mods["store"]["recordPageView"]>[0]> = {}) => ({
  visitKey,
  consentId: "consent-aaaa-1111",
  path: p,
  title: "Title",
  referrer: null,
  visitReferrer: null,
  screen: "1440x900",
  language: "en-GB",
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0 Safari/537.36",
  ip: "127.0.0.1",
  cfGeo: null,
  ...extra,
});

describe("visitor statistics store", () => {
  it("creates a visit on its first page and counts further pages", async () => {
    const geo = { countryCode: "PK", country: "Pakistan", region: "Punjab", city: "Lahore", latitude: 31.5497, longitude: 74.3436, isDatacenter: false };
    const id = await m.store.recordPageView(pv("visitkey-one-000001", "/", { cfGeo: geo, visitReferrer: "https://www.google.com" }));
    await m.store.recordPageView(pv("visitkey-one-000001", "/shop"));
    const d = await m.connect.getDb();
    const v = await d.query.analyticsVisits.findFirst({ with: { pageViews: true } });
    expect(v?.id).toBe(id);
    expect(v).toMatchObject({ landingPath: "/", pageCount: 2, city: "Lahore", countryCode: "PK", device: "desktop", browser: "Chrome", os: "Windows", referrer: "https://www.google.com" });
    expect(v?.pageViews.map((p) => p.path).sort()).toEqual(["/", "/shop"]);
  });

  it("heartbeats refresh last_seen_at but never create visits", async () => {
    const d = await m.connect.getDb();
    await m.store.recordHeartbeat("no-such-visit-key-0000", "consent-aaaa-1111");
    expect((await d.select().from(m.t.analyticsVisits)).length).toBe(1);
  });

  it("feeds the visitor map", async () => {
    const data = await m.map.getVisitorMapData({ range: "24h" });
    expect(data.places).toHaveLength(1);
    expect(data.places[0]).toMatchObject({ city: "Lahore", countryCode: "PK", lat: 31.55, lng: 74.34, visits: 1, uniqueVisitors: 1, online: true });
    expect(data.countries).toEqual([expect.objectContaining({ countryCode: "PK", country: "Pakistan", visits: 1, online: true })]);
    expect(data.latest).toMatchObject({ city: "Lahore", lat: 31.55, lng: 74.34 });
    expect((await m.map.getVisitorMapData({ range: "all", hideDatacenter: true })).places).toHaveLength(1);
  });

  it("rate-limits page views per visit and heartbeats to one per 15 s", () => {
    const now = 1_000_000;
    let ok = 0;
    for (let i = 0; i < 200; i++) if (m.store.allowHit("rate-test", "pv", now)) ok++;
    expect(ok).toBe(m.store.LIMITS.viewsPerWindow);
    expect(m.store.allowHit("rate-test", "hb", now)).toBe(true);
    expect(m.store.allowHit("rate-test", "hb", now + 5_000)).toBe(false);
    expect(m.store.allowHit("rate-test", "hb", now + 16_000)).toBe(true);
  });
});

describe("retention cleanup", () => {
  it("removes expired visits, page views over the cap, old consent records and stale geo cache", async () => {
    const d = await m.connect.getDb();
    const now = new Date();
    const old = new Date(now.getTime() - 100 * DAY);
    const [oldVisit] = await d
      .insert(m.t.analyticsVisits)
      .values({ consentId: "old-consent-0001", visitKey: "old-visit-key-000001", startedAt: old, lastSeenAt: old, landingPath: "/", pageCount: 1 })
      .returning();
    await d.insert(m.t.analyticsPageViews).values({ visitId: oldVisit.id, path: "/", createdAt: old });
    await d.insert(m.t.consentRecords).values([
      { consentId: "old-consent-0001", decision: "accept_all", categories: { statistics: true }, rev: 1, createdAt: new Date(now.getTime() - 4 * 365 * DAY) },
      { consentId: "new-consent-0001", decision: "essentials", categories: { statistics: false }, rev: 1, createdAt: now },
    ]);
    await d.insert(m.t.ipGeoCache).values([
      { ipHash: "stale", data: {}, fetchedAt: new Date(now.getTime() - 2 * DAY) },
      { ipHash: "fresh", data: {}, fetchedAt: now },
    ]);

    const r = await m.store.runCleanup(now);
    expect(r).toEqual({ visits: 1, pageViewsOverCap: 0, consentRecords: 1, geoCache: 1 });
    expect((await d.select().from(m.t.analyticsPageViews)).map((p) => p.visitId)).not.toContain(oldVisit.id); // cascade
    expect((await d.select().from(m.t.consentRecords)).map((c) => c.consentId)).toEqual(["new-consent-0001"]);
    expect((await d.select().from(m.t.ipGeoCache)).map((g) => g.ipHash)).toEqual(["fresh"]);
  });

  it("trims the oldest page views above the cap and drops emptied visits", async () => {
    const d = await m.connect.getDb();
    const now = new Date();
    const [v] = await d.insert(m.t.analyticsVisits).values({ consentId: "cap-consent-0001", visitKey: "cap-visit-key-000001", landingPath: "/", pageCount: 3 }).returning();
    const [early] = await d.insert(m.t.analyticsVisits).values({ consentId: "cap-consent-0002", visitKey: "cap-visit-key-000002", landingPath: "/a", pageCount: 1 }).returning();
    await d.insert(m.t.analyticsPageViews).values({ visitId: early.id, path: "/a", createdAt: new Date(now.getTime() - 10 * DAY) });
    await d.insert(m.t.analyticsPageViews).values([1, 2, 3].map((i) => ({ visitId: v.id, path: `/p${i}`, createdAt: new Date(now.getTime() - i * 1000) })));
    const total = (await d.select().from(m.t.analyticsPageViews)).length; // 2 (first test) + 1 + 3
    const s = { consentRev: 1, geoProvider: "off" as const, retentionDays: 90, maxPageViews: total - 2, consentRetentionDays: 1095 };
    const r = await m.store.runCleanup(now, s);
    expect(r.pageViewsOverCap).toBe(2);
    const left = await d.select().from(m.t.analyticsPageViews);
    expect(left).toHaveLength(total - 2);
    expect(left.map((p) => p.path)).not.toContain("/a");
    expect((await d.select().from(m.t.analyticsVisits)).map((x) => x.id)).not.toContain(early.id);
  });

  it("self-schedules at most once per day", async () => {
    m.store.resetCleanupClock();
    const t0 = new Date("2030-01-01T00:00:00Z");
    expect(await m.store.maybeRunDailyCleanup(t0)).not.toBeNull();
    const stamp = await m.settings.getSetting("analytics_maintenance");
    expect(stamp.lastCleanupAt).toBe(t0.toISOString());
    expect(stamp.lastSummary).toMatch(/expired visits/);
    m.store.resetCleanupClock();
    expect(await m.store.maybeRunDailyCleanup(new Date(t0.getTime() + 12 * 3_600_000))).toBeNull(); // same day
    expect(await m.store.maybeRunDailyCleanup(new Date(t0.getTime() + 12 * 3_600_000 + 60_000))).toBeNull(); // checked < 10 min ago
    m.store.resetCleanupClock();
    expect(await m.store.maybeRunDailyCleanup(new Date(t0.getTime() + 25 * 3_600_000))).not.toBeNull();
  });
});
