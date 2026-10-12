import { and, asc, desc, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { analyticsPageViews, analyticsVisits, consentRecords } from "@/lib/db/schema";
import { csvResponse, toCsv } from "@/lib/admin/csv";
import { paramsOf, staffForRoute, stamp } from "@/lib/admin/route-auth";
import { consentFilters, visitFilters } from "@/lib/analytics/stats";

/**
 * CSV exports for visitor statistics (formula-safe via csvCell):
 *   ?type=visits     — visits matching the journeys filters
 *   ?type=pageviews  — page views of those visits
 *   ?type=consent    — consent log matching its filters
 */
export async function GET(req: Request) {
  const auth = await staffForRoute("analytics.view");
  if ("error" in auth) return auth.error;
  const params = paramsOf(req);
  const type = String(params.type ?? "visits");
  const d = await db();
  if (type === "consent") {
    const rows = await d.select().from(consentRecords).where(and(...consentFilters(params))).orderBy(desc(consentRecords.createdAt)).limit(100_000);
    const cat = (r: (typeof rows)[number], k: string) => ((r.categories as Record<string, boolean>)[k] ? "yes" : "no");
    const csv = toCsv(rows, [
      { header: "At", value: (r) => r.createdAt },
      { header: "Consent id", value: (r) => r.consentId },
      { header: "Decision", value: (r) => r.decision },
      { header: "Statistics", value: (r) => cat(r, "statistics") },
      { header: "Functional", value: (r) => cat(r, "functional") },
      { header: "Marketing", value: (r) => cat(r, "marketing") },
      { header: "Consent version", value: (r) => r.rev },
      { header: "IP (shortened)", value: (r) => r.ipShort },
      { header: "User agent", value: (r) => r.userAgent },
    ]);
    return csvResponse(`wahbayaan-consent-log-${stamp()}.csv`, csv);
  }
  const visits = await d.select().from(analyticsVisits).where(and(...visitFilters(params))).orderBy(desc(analyticsVisits.startedAt)).limit(100_000);
  if (type === "pageviews") {
    const ids = visits.map((v) => v.id);
    const byId = new Map(visits.map((v) => [v.id, v]));
    const rows: (typeof analyticsPageViews.$inferSelect)[] = [];
    for (let i = 0; i < ids.length; i += 1000) {
      rows.push(...(await d.select().from(analyticsPageViews).where(inArray(analyticsPageViews.visitId, ids.slice(i, i + 1000))).orderBy(asc(analyticsPageViews.createdAt))));
    }
    const csv = toCsv(rows, [
      { header: "At", value: (r) => r.createdAt },
      { header: "Visit id", value: (r) => r.visitId },
      { header: "Consent id", value: (r) => byId.get(r.visitId)?.consentId },
      { header: "Path", value: (r) => r.path },
      { header: "Title", value: (r) => r.title },
      { header: "Referrer", value: (r) => r.referrer },
    ]);
    return csvResponse(`wahbayaan-page-views-${stamp()}.csv`, csv);
  }
  const csv = toCsv(visits, [
    { header: "Started", value: (r) => r.startedAt },
    { header: "Last seen", value: (r) => r.lastSeenAt },
    { header: "Visit id", value: (r) => r.id },
    { header: "Consent id", value: (r) => r.consentId },
    { header: "Landing page", value: (r) => r.landingPath },
    { header: "Referrer", value: (r) => r.referrer },
    { header: "Pages", value: (r) => r.pageCount },
    { header: "Country code", value: (r) => r.countryCode },
    { header: "Country", value: (r) => r.country },
    { header: "Region", value: (r) => r.region },
    { header: "City", value: (r) => r.city },
    { header: "Latitude", value: (r) => r.latitude },
    { header: "Longitude", value: (r) => r.longitude },
    { header: "Datacenter", value: (r) => (r.isDatacenter ? "yes" : "no") },
    { header: "Device", value: (r) => r.device },
    { header: "Browser", value: (r) => r.browser },
    { header: "OS", value: (r) => r.os },
    { header: "Screen", value: (r) => r.screen },
    { header: "Language", value: (r) => r.language },
  ]);
  return csvResponse(`wahbayaan-visits-${stamp()}.csv`, csv);
}
