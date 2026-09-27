import "server-only";
import { cache } from "react";
import { inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { settings } from "@/lib/db/schema";
import type { GiftWrapSetting, HandlingFeeSetting } from "@/lib/commerce/landed-cost";

/**
 * Every setting has a typed default. Business numbers (commission, handling fee,
 * gift wrap price) default to `pending` because they need a real decision.
 */
export type SettingsShape = {
  site: { name: string; supportEmail: string; whatsapp: string | null; instagram: string | null; pinterest: string | null };
  commission: { status: "pending" } | { status: "active"; defaultBps: number };
  handling_fee: HandlingFeeSetting;
  gift_wrap: GiftWrapSetting;
  escrow: { autoReleaseDaysAfterDelivery: number; status: "pending" | "active" };
  buyer_protection: { returnWindowDays: number | null; status: "pending" | "active" };
  referral: { status: "pending" | "active" | "disabled"; referrerPoints: number; refereePoints: number };
  loyalty: { status: "pending" | "active" | "disabled"; pointsPerUnit: number; pointValueMinor: number };
  fx: { markupBps: number };
  home: {
    heroEyebrow: string;
    heroTitle: string;
    heroSubtitle: string;
    featuredVendorIds: string[];
  };
  feature_flags: {
    customRequests: boolean;
    wholesale: boolean;
    limitedDrops: boolean;
    referrals: boolean;
    gifting: boolean;
    journal: boolean;
    compare: boolean;
    messaging: boolean;
  };
  maintenance: { enabled: boolean; message: string };
  seo: { titleSuffix: string; defaultDescription: string };
};

export const SETTING_DEFAULTS: SettingsShape = {
  site: { name: "Wahbayaan", supportEmail: "hello@wahbayaan.com", whatsapp: null, instagram: null, pinterest: null },
  commission: { status: "pending" },
  handling_fee: { status: "pending" },
  gift_wrap: { status: "pending" },
  escrow: { autoReleaseDaysAfterDelivery: 7, status: "pending" },
  buyer_protection: { returnWindowDays: null, status: "pending" },
  referral: { status: "pending", referrerPoints: 0, refereePoints: 0 },
  loyalty: { status: "pending", pointsPerUnit: 0, pointValueMinor: 0 },
  fx: { markupBps: 0 },
  home: {
    heroEyebrow: "Handmade in Pakistan · Delivered to your door",
    heroTitle: "Heritage craft, carried home.",
    heroSubtitle:
      "Calligraphy, rugs, stone and salt — made by verified Pakistani artisans, with the full landed cost shown before you pay.",
    featuredVendorIds: [],
  },
  feature_flags: {
    customRequests: true,
    wholesale: true,
    limitedDrops: true,
    referrals: true,
    gifting: true,
    journal: true,
    compare: true,
    messaging: true,
  },
  maintenance: { enabled: false, message: "We're making improvements and will be back shortly." },
  seo: {
    titleSuffix: "Wahbayaan",
    defaultDescription:
      "A cross-border marketplace for Pakistani heritage craft — calligraphy, hand-knotted rugs, Taxila stone, Himalayan salt and more, with landed cost shown up front.",
  },
};

export type SettingKey = keyof SettingsShape;

export const getSettings = cache(async <K extends SettingKey>(keys: K[]): Promise<Pick<SettingsShape, K>> => {
  const d = await db();
  const rows = await d.select().from(settings).where(inArray(settings.key, keys as string[]));
  const out = {} as Pick<SettingsShape, K>;
  for (const key of keys) {
    const row = rows.find((r) => r.key === key);
    out[key] = (row ? { ...(SETTING_DEFAULTS[key] as object), ...(row.value as object) } : SETTING_DEFAULTS[key]) as SettingsShape[K];
  }
  return out;
});

export async function getSetting<K extends SettingKey>(key: K): Promise<SettingsShape[K]> {
  return (await getSettings([key]))[key];
}

export async function setSetting<K extends SettingKey>(key: K, value: SettingsShape[K]) {
  const d = await db();
  await d
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

export function isDemoMode() {
  return process.env.DEMO_MODE === "true";
}
