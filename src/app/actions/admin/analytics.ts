"use server";

import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { analyticsPageViews, analyticsVisits, consentRecords, ipGeoCache } from "@/lib/db/schema";
import { getSetting, setSetting } from "@/lib/settings";
import { adminAction, AdminError } from "@/lib/admin/action";
import { changedFields } from "@/lib/admin/diff";
import { zBool, zInt, zOptStr, zUuid } from "@/lib/admin/zod";
import { BANNER_LAYOUTS, DEFAULT_CONSENT_BANNER, normalizeBanner } from "@/lib/consent/banner-settings";
import { GEO_PROVIDERS, normalizeAnalytics } from "@/lib/analytics/settings-shape";
import { runCleanup, summarizeCleanup } from "@/lib/analytics/store";

/** Insights → Privacy & tracking, Cookie banner, deletions. Every change is audited. */

export const saveAnalyticsSettingsAction = adminAction(
  "analytics.manage",
  z.object({
    geoProvider: z.enum(GEO_PROVIDERS),
    retentionDays: zInt(1, 3650),
    maxPageViews: zInt(1000, 100_000_000),
    consentRetentionDays: zInt(30, 7300),
  }),
  async ({ data, audit }) => {
    const before = normalizeAnalytics(await getSetting("analytics"));
    const after = normalizeAnalytics({ ...before, ...data });
    const fields = changedFields(before, after);
    if (!fields.length) return { message: "No changes to save" };
    await setSetting("analytics", after);
    await audit({ action: "setting.analytics", entity: "setting", entityId: "analytics", summary: `Privacy & tracking: changed ${fields.join(", ")}`, data: { before, after } });
    return { message: "Tracking settings saved" };
  },
);

export const saveGeoKeysAction = adminAction(
  "analytics.manage",
  z.object({ ipinfoToken: zOptStr(200), ip2locationKey: zOptStr(200), clearIpinfo: zBool, clearIp2location: zBool }),
  async ({ data, audit }) => {
    const before = await getSetting("analytics_secrets");
    const after = {
      ipinfoToken: data.clearIpinfo ? null : (data.ipinfoToken ?? before.ipinfoToken),
      ip2locationKey: data.clearIp2location ? null : (data.ip2locationKey ?? before.ip2locationKey),
    };
    const changed = [after.ipinfoToken !== before.ipinfoToken ? "ipinfo.io token" : null, after.ip2locationKey !== before.ip2locationKey ? "IP2Location.io key" : null].filter(Boolean);
    if (!changed.length) return { message: "No changes to save" };
    await setSetting("analytics_secrets", after);
    // Never log the key values themselves.
    await audit({ action: "setting.analytics_secrets", entity: "setting", entityId: "analytics_secrets", summary: `IP-location keys: updated ${changed.join(", ")}`, data: { ipinfoToken: after.ipinfoToken ? "set" : "not set", ip2locationKey: after.ip2locationKey ? "set" : "not set" } });
    return { message: "Keys saved" };
  },
);

export const bumpConsentVersionAction = adminAction("analytics.manage", z.object({}), async ({ audit }) => {
  const before = normalizeAnalytics(await getSetting("analytics"));
  const after = { ...before, consentRev: before.consentRev + 1 };
  await setSetting("analytics", after);
  await audit({ action: "consent.version_bump", entity: "setting", entityId: "analytics", summary: `Consent version raised from ${before.consentRev} to ${after.consentRev} — every visitor is asked again`, data: { before: before.consentRev, after: after.consentRev } });
  return { message: `Consent version is now ${after.consentRev}. Every visitor will be asked again.` };
});

export const saveBannerPresetAction = adminAction(
  "analytics.manage",
  z.object({ layout: z.enum(BANNER_LAYOUTS), floatingButton: zBool }),
  async ({ data, audit }) => {
    const before = normalizeBanner(await getSetting("consent_banner"));
    const after = { ...before, layout: data.layout, floatingButton: data.floatingButton };
    const fields = changedFields(before, after);
    if (!fields.length) return { message: "No changes to save" };
    await setSetting("consent_banner", after);
    await audit({ action: "setting.consent_banner", entity: "setting", entityId: "consent_banner", summary: `Cookie banner: changed ${fields.join(", ")}`, data: { before: { layout: before.layout, floatingButton: before.floatingButton }, after: data } });
    return { message: "Banner options saved" };
  },
);

/** The editor posts the whole banner as JSON; it is normalised (types, ranges, colours) before saving. */
export const saveBannerAction = adminAction("analytics.manage", z.object({ banner: z.string().min(2).max(50_000) }), async ({ data, audit }) => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data.banner);
  } catch {
    throw new AdminError("The banner settings could not be read. Reload the page and try again.");
  }
  const before = normalizeBanner(await getSetting("consent_banner"));
  const after = normalizeBanner(parsed);
  const fields = changedFields(before, after);
  if (!fields.length) return { message: "No changes to save" };
  await setSetting("consent_banner", after);
  await audit({ action: "setting.consent_banner", entity: "setting", entityId: "consent_banner", summary: `Cookie banner: changed ${fields.join(", ")}`, data: { before, after } });
  return { message: "Cookie banner saved" };
});

export const resetBannerAction = adminAction("analytics.manage", z.object({}), async ({ audit }) => {
  const before = normalizeBanner(await getSetting("consent_banner"));
  const after = { ...DEFAULT_CONSENT_BANNER, layout: before.layout, floatingButton: before.floatingButton };
  await setSetting("consent_banner", after);
  await audit({ action: "setting.consent_banner", entity: "setting", entityId: "consent_banner", summary: "Cookie banner: look and texts reset to defaults", data: { before, after } });
  return { message: "Banner reset to the default look and texts" };
});

export const deleteVisitAction = adminAction("analytics.manage", z.object({ id: zUuid }), async ({ data, audit }) => {
  const d = await db();
  const [v] = await d.delete(analyticsVisits).where(eq(analyticsVisits.id, data.id)).returning({ id: analyticsVisits.id, consentId: analyticsVisits.consentId, pageCount: analyticsVisits.pageCount });
  if (!v) throw new AdminError("That visit no longer exists.");
  await audit({ action: "analytics.delete_visit", entity: "analytics_visit", entityId: v.id, summary: `Deleted a visit (${v.pageCount} page views) of consent id ${v.consentId}` });
  redirect("/admin/analytics/visits");
});

export const deleteConsentDataAction = adminAction(
  "analytics.manage",
  z.object({ consentId: z.string().trim().regex(/^[A-Za-z0-9_-]{8,64}$/, "Enter a consent id (8–64 letters, digits, - or _)"), includeRecords: zBool }),
  async ({ data, audit }) => {
    const d = await db();
    const visits = await d.delete(analyticsVisits).where(eq(analyticsVisits.consentId, data.consentId)).returning({ id: analyticsVisits.id });
    const records = data.includeRecords ? await d.delete(consentRecords).where(eq(consentRecords.consentId, data.consentId)).returning({ id: consentRecords.id }) : [];
    if (!visits.length && !records.length) return { message: "Nothing stored for that consent id" };
    const summary = `Deleted visitor data for consent id ${data.consentId}: ${visits.length} visits${data.includeRecords ? `, ${records.length} consent records` : ""}`;
    await audit({ action: "analytics.delete_consent_id", entity: "analytics", entityId: data.consentId, summary });
    return { message: summary };
  },
);

export const deleteAllVisitorDataAction = adminAction(
  "analytics.manage",
  z.object({ confirm: z.string().trim(), includeRecords: zBool }),
  async ({ data, audit }) => {
    if (data.confirm !== "DELETE") throw new AdminError("Type DELETE to confirm.");
    const d = await db();
    const [{ visits }] = await d.select({ visits: sql<number>`count(*)::int` }).from(analyticsVisits);
    const [{ views }] = await d.select({ views: sql<number>`count(*)::int` }).from(analyticsPageViews);
    await d.delete(analyticsPageViews);
    await d.delete(analyticsVisits);
    await d.delete(ipGeoCache);
    let records = 0;
    if (data.includeRecords) records = (await d.delete(consentRecords).returning({ id: consentRecords.id })).length;
    const summary = `Deleted all visitor data: ${visits} visits, ${views} page views, location cache${data.includeRecords ? `, ${records} consent records` : ""}`;
    await audit({ action: "analytics.delete_all", entity: "analytics", summary });
    return { message: summary };
  },
);

export const runCleanupNowAction = adminAction("analytics.manage", z.object({}), async ({ audit }) => {
  const now = new Date();
  const result = await runCleanup(now);
  const summary = summarizeCleanup(result);
  await setSetting("analytics_maintenance", { lastCleanupAt: now.toISOString(), lastSummary: summary });
  await audit({ action: "analytics.cleanup", entity: "analytics", summary: `Ran retention cleanup: ${summary}`, data: result });
  return { message: `Cleanup done: ${summary}` };
});
