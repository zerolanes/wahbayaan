import "server-only";
import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { analyticsPageViews, analyticsVisits, consentRecords, ipGeoCache } from "@/lib/db/schema";
import { getSetting, setSetting } from "@/lib/settings";
import { normalizeBanner, type ConsentBannerSetting } from "@/lib/consent/banner-settings";
import type { ConsentCategories, ConsentDecision } from "@/lib/consent/core";
import { lookupGeo } from "./geo";
import { parseUserAgent, type GeoData } from "./request-info";
import { normalizeAnalytics, type AnalyticsSetting } from "./settings-shape";

export async function getAnalyticsSettings(): Promise<AnalyticsSetting> {
  return normalizeAnalytics(await getSetting("analytics"));
}

export async function getConsentBanner(): Promise<ConsentBannerSetting> {
  return normalizeBanner(await getSetting("consent_banner"));
}

// ── Rate limits (per process; good enough for a single Railway instance) ─────

type Bucket = { windowStart: number; views: number; lastBeat: number };
const buckets = new Map<string, Bucket>();
const newVisitsByIp = new Map<string, { windowStart: number; n: number }>();
const WINDOW = 10 * 60_000;
export const LIMITS = { viewsPerWindow: 120, beatEveryMs: 15_000, newVisitsPerIpPerHour: 60 };

/** True when this hit may be stored. Page views: 120 per visit per 10 minutes. Heartbeats: one per 15 s. */
export function allowHit(visitKey: string, kind: "pv" | "hb", now = Date.now()): boolean {
  if (buckets.size > 50_000) buckets.clear();
  const b = buckets.get(visitKey) ?? { windowStart: now, views: 0, lastBeat: 0 };
  if (now - b.windowStart > WINDOW) {
    b.windowStart = now;
    b.views = 0;
  }
  let ok: boolean;
  if (kind === "pv") {
    ok = b.views < LIMITS.viewsPerWindow;
    if (ok) b.views++;
  } else {
    ok = now - b.lastBeat >= LIMITS.beatEveryMs;
    if (ok) b.lastBeat = now;
  }
  buckets.set(visitKey, b);
  return ok;
}

export function allowNewVisit(ipKey: string, now = Date.now()): boolean {
  if (newVisitsByIp.size > 50_000) newVisitsByIp.clear();
  const e = newVisitsByIp.get(ipKey);
  if (!e || now - e.windowStart > 3_600_000) {
    newVisitsByIp.set(ipKey, { windowStart: now, n: 1 });
    return true;
  }
  e.n++;
  return e.n <= LIMITS.newVisitsPerIpPerHour;
}

// ── Writes ──────────────────────────────────────────────────────────────────

export type PageViewInput = {
  visitKey: string;
  consentId: string;
  path: string;
  title: string | null;
  referrer: string | null;
  /** External referrer for a new visit. */
  visitReferrer: string | null;
  screen: string | null;
  language: string | null;
  userAgent: string | null;
  ip: string | null;
  cfGeo: GeoData | null;
};

/** Store one page view, creating the visit on its first page. Location is looked up once per visit. */
export async function recordPageView(input: PageViewInput, settings?: AnalyticsSetting) {
  const d = await db();
  const now = new Date();
  const ua = parseUserAgent(input.userAgent);
  const inserted = await d
    .insert(analyticsVisits)
    .values({
      consentId: input.consentId,
      visitKey: input.visitKey,
      startedAt: now,
      lastSeenAt: now,
      landingPath: input.path,
      referrer: input.visitReferrer,
      device: ua.device,
      browser: ua.browser,
      os: ua.os,
      screen: input.screen,
      language: input.language,
      pageCount: 1,
      ...(input.cfGeo ? geoColumns(input.cfGeo) : {}),
    })
    .onConflictDoUpdate({
      target: analyticsVisits.visitKey,
      set: { lastSeenAt: now, pageCount: sql`${analyticsVisits.pageCount} + 1` },
    })
    .returning({ id: analyticsVisits.id, pageCount: analyticsVisits.pageCount, countryCode: analyticsVisits.countryCode });
  const visit = inserted[0];
  await d.insert(analyticsPageViews).values({ visitId: visit.id, path: input.path, title: input.title, referrer: input.referrer, createdAt: now });
  // First page of a visit without Cloudflare location: ask the configured provider.
  if (visit.pageCount === 1 && !visit.countryCode && !input.cfGeo && input.ip) {
    const s = settings ?? (await getAnalyticsSettings());
    const geo = await lookupGeo(input.ip, s.geoProvider);
    if (geo) await d.update(analyticsVisits).set(geoColumns(geo)).where(eq(analyticsVisits.id, visit.id));
  }
  return visit.id;
}

function geoColumns(g: GeoData) {
  return {
    countryCode: g.countryCode,
    country: g.country,
    region: g.region,
    city: g.city,
    latitude: g.latitude,
    longitude: g.longitude,
    isDatacenter: g.isDatacenter,
  };
}

/** Heartbeat: keeps the visit "live" (last_seen_at). Never creates a visit. */
export async function recordHeartbeat(visitKey: string, consentId: string) {
  const d = await db();
  await d
    .update(analyticsVisits)
    .set({ lastSeenAt: new Date() })
    .where(and(eq(analyticsVisits.visitKey, visitKey), eq(analyticsVisits.consentId, consentId)));
}

export async function recordConsent(r: { consentId: string; decision: ConsentDecision; categories: ConsentCategories; rev: number; ipShort: string | null; userAgent: string | null }) {
  const d = await db();
  await d.insert(consentRecords).values({
    consentId: r.consentId,
    decision: r.decision,
    categories: r.categories,
    rev: r.rev,
    ipShort: r.ipShort,
    userAgent: r.userAgent?.slice(0, 400) ?? null,
  });
}

// ── Retention ───────────────────────────────────────────────────────────────

export type CleanupResult = { visits: number; pageViewsOverCap: number; consentRecords: number; geoCache: number };

/**
 * Delete visits (and their page views) older than the retention period, trim
 * page views above the cap (oldest first), drop expired consent records and
 * stale location cache rows.
 */
export async function runCleanup(now = new Date(), settings?: AnalyticsSetting): Promise<CleanupResult> {
  const s = settings ?? (await getAnalyticsSettings());
  const d = await db();
  const visitCutoff = new Date(now.getTime() - s.retentionDays * 86_400_000);
  const consentCutoff = new Date(now.getTime() - s.consentRetentionDays * 86_400_000);
  const geoCutoff = new Date(now.getTime() - 86_400_000);
  const visits = await d.delete(analyticsVisits).where(lt(analyticsVisits.lastSeenAt, visitCutoff)).returning({ id: analyticsVisits.id });
  // Cap: keep the newest `maxPageViews` page views.
  const [{ n }] = await d.select({ n: sql<number>`count(*)::int` }).from(analyticsPageViews);
  let pageViewsOverCap = 0;
  if (Number(n) > s.maxPageViews) {
    const over = Number(n) - s.maxPageViews;
    const removed = await d
      .delete(analyticsPageViews)
      .where(sql`${analyticsPageViews.id} in (select id from analytics_page_views order by created_at asc limit ${over})`)
      .returning({ id: analyticsPageViews.id });
    pageViewsOverCap = removed.length;
    // Visits left without any page view go too.
    await d.delete(analyticsVisits).where(sql`not exists (select 1 from analytics_page_views pv where pv.visit_id = ${analyticsVisits.id})`);
  }
  const consents = await d.delete(consentRecords).where(lt(consentRecords.createdAt, consentCutoff)).returning({ id: consentRecords.id });
  const geo = await d.delete(ipGeoCache).where(lt(ipGeoCache.fetchedAt, geoCutoff)).returning({ h: ipGeoCache.ipHash });
  return { visits: visits.length, pageViewsOverCap, consentRecords: consents.length, geoCache: geo.length };
}

let lastCheck = 0;
let running = false;

/**
 * Self-scheduling daily cleanup for hosts without a scheduler (Railway): the
 * ingest route calls this after responding; it checks the stored timestamp at
 * most every 10 minutes and runs the cleanup at most once per 24 hours.
 */
export async function maybeRunDailyCleanup(now = new Date()): Promise<CleanupResult | null> {
  if (running || now.getTime() - lastCheck < 10 * 60_000) return null;
  lastCheck = now.getTime();
  const m = await getSetting("analytics_maintenance");
  if (m.lastCleanupAt && now.getTime() - new Date(m.lastCleanupAt).getTime() < 86_400_000) return null;
  running = true;
  try {
    // Claim the slot first so a second process doesn't start the same run.
    await setSetting("analytics_maintenance", { ...m, lastCleanupAt: now.toISOString() });
    const result = await runCleanup(now);
    await setSetting("analytics_maintenance", { lastCleanupAt: now.toISOString(), lastSummary: summarizeCleanup(result) });
    return result;
  } finally {
    running = false;
  }
}

export function summarizeCleanup(r: CleanupResult) {
  return `${r.visits} expired visits, ${r.pageViewsOverCap} page views over the cap, ${r.consentRecords} expired consent records, ${r.geoCache} location cache rows removed`;
}

/** For tests. */
export function resetCleanupClock() {
  lastCheck = 0;
}
