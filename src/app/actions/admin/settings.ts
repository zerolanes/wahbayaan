"use server";

import { inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { vendors } from "@/lib/db/schema";
import { getSetting, setSetting, type SettingKey, type SettingsShape } from "@/lib/settings";
import { adminAction, AdminError, type AuditEntry } from "@/lib/admin/action";
import { changedFields } from "@/lib/admin/diff";
import { FLAG_KEYS, FLAG_META } from "@/lib/admin/flags";
import { zBool, zInt, zOptMoney, zOptStr, zStr } from "@/lib/admin/zod";

/** Save one typed setting and record exactly which fields changed. */
async function saveSetting<K extends SettingKey>(key: K, label: string, value: SettingsShape[K], audit: (e: AuditEntry) => Promise<void>) {
  const before = await getSetting(key);
  const fields = changedFields(before, value);
  if (!fields.length) return { message: "No changes to save" };
  await setSetting(key, value);
  await audit({ action: `setting.${key}`, entity: "setting", entityId: key, summary: `${label}: changed ${fields.join(", ")}`, data: { before, after: value } });
  return { message: `${label} saved` };
}

const zUrlOrNull = zOptStr(300).refine((v) => !v || /^https?:\/\//.test(v), "Use a full link starting with https://");

export const saveSiteSettingsAction = adminAction(
  "settings.manage",
  z.object({ name: zStr(80), supportEmail: z.email("Enter a valid support email"), whatsapp: zOptStr(40), instagram: zUrlOrNull, pinterest: zUrlOrNull }),
  async ({ data, audit }) => saveSetting("site", "Store info", data, audit),
);

export const saveSeoSettingsAction = adminAction(
  "settings.manage",
  z.object({ titleSuffix: zStr(60), defaultDescription: zStr(300) }),
  async ({ data, audit }) => saveSetting("seo", "Search & sharing", data, audit),
);

export const saveHomeSettingsAction = adminAction(
  "settings.manage",
  z.object({
    heroEyebrow: zStr(120),
    heroTitle: zStr(120),
    heroSubtitle: zStr(400),
    featuredVendorIds: z.preprocess((v) => (v == null ? [] : Array.isArray(v) ? v : [v]), z.array(z.string().uuid()).max(12, "Feature at most 12 artisans")),
  }),
  async ({ data, audit }) => {
    if (data.featuredVendorIds.length) {
      const d = await db();
      const found = await d.select({ id: vendors.id }).from(vendors).where(inArray(vendors.id, data.featuredVendorIds));
      if (found.length !== data.featuredVendorIds.length) throw new AdminError("One of the featured artisans no longer exists.");
    }
    return saveSetting("home", "Homepage hero", data, audit);
  },
);

export const saveMaintenanceAction = adminAction("settings.manage", z.object({ enabled: zBool, message: zStr(300) }), async ({ data, audit }) =>
  saveSetting("maintenance", "Maintenance mode", data, audit),
);

export const savePayoutScheduleAction = adminAction(
  "settings.manage",
  z.object({ status: z.enum(["pending", "active"]), schedule: z.enum(["weekly", "fortnightly", "monthly"]), minimumPkr: zOptMoney, note: zOptStr(300) }),
  async ({ data, audit }) => {
    if (data.status === "active" && data.minimumPkr == null) throw new AdminError("Enter the minimum payout (0 for none) before confirming the schedule.");
    return saveSetting("payouts", "Payout schedule", data, audit);
  },
);

const programStatus = z.enum(["pending", "active", "disabled"]);

export const saveReferralSettingsAction = adminAction(
  "settings.manage",
  z.object({ status: programStatus, referrerPoints: zInt(0, 100_000), refereePoints: zInt(0, 100_000) }),
  async ({ data, audit }) => {
    if (data.status === "active" && !data.referrerPoints && !data.refereePoints) throw new AdminError("Set the points each side earns before activating referrals.");
    return saveSetting("referral", "Referral programme", data, audit);
  },
);

export const saveLoyaltySettingsAction = adminAction(
  "settings.manage",
  z.object({ status: programStatus, pointsPerUnit: zInt(0, 10_000), pointValueMinor: zInt(0, 100_000) }),
  async ({ data, audit }) => {
    if (data.status === "active" && (!data.pointsPerUnit || !data.pointValueMinor)) throw new AdminError("Set points per unit and the value of a point before activating loyalty.");
    return saveSetting("loyalty", "Loyalty programme", data, audit);
  },
);

// ── Feature flags ───────────────────────────────────────────────────────────

const zFlag = z.enum(FLAG_KEYS as [string, ...string[]]);

export const setFeatureFlagAction = adminAction("settings.manage", z.object({ flag: zFlag, enabled: zBool }), async ({ data, audit }) => {
  const before = await getSetting("feature_flags");
  const key = data.flag as keyof typeof before;
  if (before[key] === data.enabled) return { message: "No change" };
  const after = { ...before, [key]: data.enabled };
  await setSetting("feature_flags", after);
  const label = FLAG_META[key].label;
  await audit({ action: "setting.feature_flags", entity: "setting", entityId: "feature_flags", summary: `${label} turned ${data.enabled ? "on" : "off"}`, data: { before, after } });
  return { message: `${label} ${data.enabled ? "enabled" : "disabled"}` };
});
