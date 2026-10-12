import "server-only";
import { and, count, countDistinct, desc, eq, gte, ilike, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { analyticsPageViews, analyticsVisits, consentRecords } from "@/lib/db/schema";
import { dateRange, isoDay, pageOf, PAGE_SIZE, str, type SearchParams } from "@/lib/admin/params";
import { likeTerm } from "@/lib/admin/sql";

/** Visits with a heartbeat or page view in the last 2 minutes count as "live". */
export const LIVE_WINDOW_MS = 2 * 60_000;

export const PERIODS = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
] as const;
export type PeriodKey = (typeof PERIODS)[number]["key"] | "custom";

export type StatsRange = { key: PeriodKey; from: Date; to: Date; days: number; fromStr: string; toStr: string; hourly: boolean };

/** Period chips (today / 7d / 30d / 90d) or a custom from–to (UTC days, inclusive). */
export function statsRange(params: SearchParams, now = new Date()): StatsRange {
  const p = str(params, "period");
  const todayStart = new Date(`${isoDay(now)}T00:00:00.000Z`);
  if (p === "custom" || (!p && (str(params, "from") || str(params, "to")))) {
    const r = dateRange(params, 7, now);
    return { key: "custom", from: r.from, to: r.toExclusive, days: r.days, fromStr: r.fromStr, toStr: r.toStr, hourly: r.days === 1 };
  }
  const days = p === "today" ? 1 : p === "30d" ? 30 : p === "90d" ? 90 : 7;
  const from = new Date(todayStart.getTime() - (days - 1) * 86_400_000);
  const to = new Date(todayStart.getTime() + 86_400_000);
  return { key: (p === "today" || p === "30d" || p === "90d" ? p : "7d") as PeriodKey, from, to, days, fromStr: isoDay(from), toStr: isoDay(todayStart), hourly: days === 1 };
}

const n = (v: unknown) => Number(v ?? 0);

export async function getStats(range: StatsRange) {
  const d = await db();
  const pvIn = and(gte(analyticsPageViews.createdAt, range.from), lt(analyticsPageViews.createdAt, range.to));
  const visitIn = and(gte(analyticsVisits.startedAt, range.from), lt(analyticsVisits.startedAt, range.to));
  const bucket = range.hourly ? sql<string>`to_char(date_trunc('hour', ${analyticsPageViews.createdAt} at time zone 'UTC'), 'YYYY-MM-DD"T"HH24')` : sql<string>`to_char(${analyticsPageViews.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`;
  const vbucket = range.hourly ? sql<string>`to_char(date_trunc('hour', ${analyticsVisits.startedAt} at time zone 'UTC'), 'YYYY-MM-DD"T"HH24')` : sql<string>`to_char(${analyticsVisits.startedAt} at time zone 'UTC', 'YYYY-MM-DD')`;

  const [[views], [visits], viewSeries, visitSeries, pages, referrers, countries, devices, browsers, oses] = await Promise.all([
    d.select({ n: count() }).from(analyticsPageViews).where(pvIn),
    d.select({ n: count(), unique: countDistinct(analyticsVisits.consentId) }).from(analyticsVisits).where(visitIn),
    d.select({ k: bucket, n: count() }).from(analyticsPageViews).where(pvIn).groupBy(bucket),
    d.select({ k: vbucket, n: count() }).from(analyticsVisits).where(visitIn).groupBy(vbucket),
    d
      .select({ path: analyticsPageViews.path, views: count(), visits: countDistinct(analyticsPageViews.visitId) })
      .from(analyticsPageViews)
      .where(pvIn)
      .groupBy(analyticsPageViews.path)
      .orderBy(desc(count()))
      .limit(15),
    d
      .select({ referrer: analyticsVisits.referrer, visits: count() })
      .from(analyticsVisits)
      .where(visitIn)
      .groupBy(analyticsVisits.referrer)
      .orderBy(desc(count()))
      .limit(12),
    d
      .select({ code: analyticsVisits.countryCode, name: analyticsVisits.country, visits: count(), unique: countDistinct(analyticsVisits.consentId) })
      .from(analyticsVisits)
      .where(visitIn)
      .groupBy(analyticsVisits.countryCode, analyticsVisits.country)
      .orderBy(desc(count()))
      .limit(15),
    d.select({ k: analyticsVisits.device, visits: count() }).from(analyticsVisits).where(visitIn).groupBy(analyticsVisits.device).orderBy(desc(count())),
    d.select({ k: analyticsVisits.browser, visits: count() }).from(analyticsVisits).where(visitIn).groupBy(analyticsVisits.browser).orderBy(desc(count())).limit(8),
    d.select({ k: analyticsVisits.os, visits: count() }).from(analyticsVisits).where(visitIn).groupBy(analyticsVisits.os).orderBy(desc(count())).limit(8),
  ]);

  // One bucket per hour (today) or per day, gaps filled with zero.
  const keys: { key: string; label: string }[] = [];
  if (range.hourly) {
    for (let h = 0; h < 24; h++) {
      const t = new Date(range.from.getTime() + h * 3_600_000);
      keys.push({ key: t.toISOString().slice(0, 13), label: `${String(t.getUTCHours()).padStart(2, "0")}:00` });
    }
  } else {
    const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
    for (let i = 0; i < range.days; i++) {
      const t = new Date(range.from.getTime() + i * 86_400_000);
      keys.push({ key: isoDay(t), label: fmt.format(t) });
    }
  }
  const vMap = new Map(viewSeries.map((r) => [r.k, n(r.n)]));
  const sMap = new Map(visitSeries.map((r) => [r.k, n(r.n)]));
  const series = keys.map((k) => ({ ...k, views: vMap.get(k.key) ?? 0, visits: sMap.get(k.key) ?? 0 }));

  const totalViews = n(views.n);
  const totalVisits = n(visits.n);
  return {
    totals: {
      views: totalViews,
      visits: totalVisits,
      uniqueVisitors: n(visits.unique),
      pagesPerVisit: totalVisits ? totalViews / totalVisits : null,
    },
    series,
    pages: pages.map((p) => ({ path: p.path, views: n(p.views), visits: n(p.visits) })),
    referrers: referrers.map((r) => ({ referrer: r.referrer, visits: n(r.visits) })),
    countries: countries.map((c) => ({ code: c.code, name: c.name, visits: n(c.visits), unique: n(c.unique) })),
    devices: devices.map((r) => ({ key: r.k ?? "Unknown", visits: n(r.visits) })),
    browsers: browsers.map((r) => ({ key: r.k ?? "Unknown", visits: n(r.visits) })),
    oses: oses.map((r) => ({ key: r.k ?? "Unknown", visits: n(r.visits) })),
  };
}

export async function getLiveVisits(now = new Date()) {
  const d = await db();
  const since = new Date(now.getTime() - LIVE_WINDOW_MS);
  const rows = await d
    .select({
      id: analyticsVisits.id,
      consentId: analyticsVisits.consentId,
      startedAt: analyticsVisits.startedAt,
      lastSeenAt: analyticsVisits.lastSeenAt,
      landingPath: analyticsVisits.landingPath,
      referrer: analyticsVisits.referrer,
      country: analyticsVisits.country,
      countryCode: analyticsVisits.countryCode,
      city: analyticsVisits.city,
      device: analyticsVisits.device,
      browser: analyticsVisits.browser,
      pageCount: analyticsVisits.pageCount,
      isDatacenter: analyticsVisits.isDatacenter,
      currentPath: sql<string | null>`(select pv.path from analytics_page_views pv where pv.visit_id = ${analyticsVisits.id} order by pv.created_at desc limit 1)`,
    })
    .from(analyticsVisits)
    .where(gte(analyticsVisits.lastSeenAt, since))
    .orderBy(desc(analyticsVisits.lastSeenAt))
    .limit(200);
  return rows;
}

export function visitFilters(params: SearchParams): SQL[] {
  const where: SQL[] = [];
  const q = str(params, "q");
  if (q) where.push(or(ilike(analyticsVisits.consentId, likeTerm(q)), ilike(analyticsVisits.landingPath, likeTerm(q)), ilike(analyticsVisits.city, likeTerm(q)), ilike(analyticsVisits.country, likeTerm(q)))!);
  const country = str(params, "country").toUpperCase();
  if (/^[A-Z]{2}$/.test(country)) where.push(eq(analyticsVisits.countryCode, country));
  if (country === "--") where.push(isNull(analyticsVisits.countryCode));
  const device = str(params, "device");
  if (device) where.push(eq(analyticsVisits.device, device));
  const from = str(params, "from");
  const to = str(params, "to");
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) where.push(gte(analyticsVisits.startedAt, new Date(`${from}T00:00:00Z`)));
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) where.push(lt(analyticsVisits.startedAt, new Date(new Date(`${to}T00:00:00Z`).getTime() + 86_400_000)));
  return where;
}

export async function listVisits(params: SearchParams) {
  const d = await db();
  const where = and(...visitFilters(params));
  const page = pageOf(params);
  const [rows, [{ total }]] = await Promise.all([
    d.select().from(analyticsVisits).where(where).orderBy(desc(analyticsVisits.startedAt)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
    d.select({ total: count() }).from(analyticsVisits).where(where),
  ]);
  return { rows, total: n(total), page };
}

export async function getVisitJourney(id: string) {
  const d = await db();
  const [visit] = await d.select().from(analyticsVisits).where(eq(analyticsVisits.id, id)).limit(1);
  if (!visit) return null;
  const [views, others] = await Promise.all([
    d.select().from(analyticsPageViews).where(eq(analyticsPageViews.visitId, id)).orderBy(analyticsPageViews.createdAt),
    d
      .select({ id: analyticsVisits.id, startedAt: analyticsVisits.startedAt, pageCount: analyticsVisits.pageCount, landingPath: analyticsVisits.landingPath })
      .from(analyticsVisits)
      .where(and(eq(analyticsVisits.consentId, visit.consentId), sql`${analyticsVisits.id} <> ${id}`))
      .orderBy(desc(analyticsVisits.startedAt))
      .limit(20),
  ]);
  return { visit, views, others };
}

export function consentFilters(params: SearchParams): SQL[] {
  const where: SQL[] = [];
  const q = str(params, "q");
  if (q) where.push(or(ilike(consentRecords.consentId, likeTerm(q)), ilike(consentRecords.ipShort, likeTerm(q)))!);
  const decision = str(params, "decision");
  if (["accept_all", "essentials", "custom", "revoke"].includes(decision)) where.push(eq(consentRecords.decision, decision));
  const rev = Number(str(params, "rev"));
  if (Number.isInteger(rev) && rev > 0) where.push(eq(consentRecords.rev, rev));
  const from = str(params, "from");
  const to = str(params, "to");
  if (/^\d{4}-\d{2}-\d{2}$/.test(from)) where.push(gte(consentRecords.createdAt, new Date(`${from}T00:00:00Z`)));
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) where.push(lt(consentRecords.createdAt, new Date(new Date(`${to}T00:00:00Z`).getTime() + 86_400_000)));
  return where;
}

export async function listConsentRecords(params: SearchParams) {
  const d = await db();
  const where = and(...consentFilters(params));
  const page = pageOf(params);
  const [rows, [{ total }], byDecision] = await Promise.all([
    d.select().from(consentRecords).where(where).orderBy(desc(consentRecords.createdAt)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE),
    d.select({ total: count() }).from(consentRecords).where(where),
    d.select({ decision: consentRecords.decision, n: count() }).from(consentRecords).where(where).groupBy(consentRecords.decision),
  ]);
  return { rows, total: n(total), page, byDecision: Object.fromEntries(byDecision.map((r) => [r.decision, n(r.n)])) as Record<string, number> };
}

export async function storageCounts() {
  const d = await db();
  const [[v], [p], [c], [oldest]] = await Promise.all([
    d.select({ n: count() }).from(analyticsVisits),
    d.select({ n: count() }).from(analyticsPageViews),
    d.select({ n: count() }).from(consentRecords),
    d.select({ at: sql<string | null>`min(${analyticsVisits.startedAt})` }).from(analyticsVisits),
  ]);
  return { visits: n(v.n), pageViews: n(p.n), consentRecords: n(c.n), oldestVisit: oldest.at ? new Date(oldest.at) : null };
}
