"use server";

import { z } from "zod";
import { adminAction, AdminError } from "@/lib/admin/action";
import { parseMoneyInput } from "@/lib/admin/money";
import { zBool, zOptBps, zOptInt, zOptMoney, zOptStr } from "@/lib/admin/zod";
import { validateMarginRule, type MarginRule, type MarginTier } from "@/lib/brands/margin";
import { PAYMENT_METHODS } from "@/lib/payments/methods";
import { getSetting, setSetting } from "@/lib/settings";

const zList = z.preprocess((v) => (v == null ? [] : Array.isArray(v) ? v : [v]), z.array(z.string()));

/** Wahbayaan service fee for Pakistani Brands, per market. */
export const saveMarginAction = adminAction(
  "rates.manage",
  z.object({
    scope: z.enum(["domestic", "international"]),
    status: z.enum(["pending", "active"]),
    mode: z.enum(["tiers", "percent"]),
    percent: zOptBps,
    minFee: zOptMoney,
    maxFee: zOptMoney,
    note: zOptStr(500),
    tierMin: zList,
    tierMax: zList,
    tierFee: zList,
  }),
  async ({ data, audit }) => {
    const tiers: MarginTier[] = [];
    data.tierMin.forEach((minText, i) => {
      const min = parseMoneyInput(minText);
      const max = parseMoneyInput(data.tierMax[i] ?? "");
      const fee = parseMoneyInput(data.tierFee[i] ?? "");
      if (min == null && max == null && fee == null) return;
      if (min == null || Number.isNaN(min) || Number.isNaN(max ?? 0) || Number.isNaN(fee ?? 0)) throw new AdminError(`Band ${i + 1}: enter amounts in rupees, e.g. 3000.`);
      tiers.push({ minPkr: min, maxPkr: max, feePkr: fee });
    });
    tiers.sort((a, b) => a.minPkr - b.minPkr);
    const rule: MarginRule = { status: data.status, mode: data.mode, tiers, percentBps: data.percent, minFeePkr: data.minFee, maxFeePkr: data.maxFee, note: data.note };
    const problem = validateMarginRule(rule);
    if (problem) throw new AdminError(problem);
    if (rule.status === "active" && rule.mode === "tiers" && !tiers.some((t) => t.feePkr != null) && !rule.percentBps) throw new AdminError("Add at least one band with a fee, or leave the fee pending.");
    const before = await getSetting("brand_margin");
    const after = { ...before, [data.scope]: rule };
    await setSetting("brand_margin", after);
    await audit({ action: "settings.brand_margin", entity: "settings", entityId: "brand_margin", summary: `Updated the ${data.scope} Wahbayaan service fee (${rule.status}, ${rule.mode})`, data: { before: before[data.scope], after: rule } });
    return { message: "Service fee saved" };
  },
);

/** City zones for delivery inside Pakistan, and the brand-to-dispatch handling time. */
export const saveDomesticZonesAction = adminAction(
  "couriers.manage",
  z.object({ zoneKey: zList, zoneLabel: zList, zoneCities: zList, handlingDays: zOptInt(0, 60) }),
  async ({ data, audit }) => {
    const zones = data.zoneKey
      .map((key, i) => ({
        key: key.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"),
        label: (data.zoneLabel[i] ?? "").trim() || key,
        cities: (data.zoneCities[i] ?? "").split(/[,\n]/).map((c) => c.trim()).filter(Boolean),
      }))
      .filter((z) => z.key);
    if (new Set(zones.map((z) => z.key)).size !== zones.length) throw new AdminError("Zone keys must be unique.");
    const seen = new Map<string, string>();
    for (const z of zones)
      for (const c of z.cities) {
        const k = c.toLowerCase();
        if (seen.has(k)) throw new AdminError(`${c} is listed in two zones (${seen.get(k)} and ${z.label}).`);
        seen.set(k, z.label);
      }
    const before = await getSetting("domestic_delivery");
    const after = { ...before, zones, handlingDays: data.handlingDays };
    await setSetting("domestic_delivery", after);
    await audit({ action: "settings.domestic_delivery", entity: "settings", entityId: "domestic_delivery", summary: `Updated domestic delivery zones (${zones.length}) and handling time`, data: { before, after } });
    return { message: "Domestic delivery saved" };
  },
);

/** Non-secret payment-method settings. Secrets are environment variables and never pass through here. */
export const savePaymentMethodAction = adminAction(
  "payments.manage",
  z.object({
    method: z.enum(PAYMENT_METHODS),
    displayName: z.string().trim().min(2).max(60),
    enabledDomestic: zBool,
    enabledInternational: zBool,
    merchantId: zOptStr(80).refine((v) => !v || /^[A-Za-z0-9_-]+$/.test(v), "Merchant / store id: letters, numbers, - and _ only"),
    mode: z.enum(["sandbox", "live"]),
  }),
  async ({ data, audit }) => {
    const before = await getSetting("payment_methods");
    const config = { displayName: data.displayName, enabledDomestic: data.enabledDomestic, enabledInternational: data.enabledInternational, merchantId: data.method === "card" ? null : data.merchantId, mode: data.mode };
    await setSetting("payment_methods", { ...before, [data.method]: config });
    await audit({ action: "settings.payment_methods", entity: "settings", entityId: "payment_methods", summary: `Updated ${data.displayName} (${data.mode}; Pakistan ${config.enabledDomestic ? "on" : "off"}, international ${config.enabledInternational ? "on" : "off"})`, data: { before: before[data.method], after: config } });
    return { message: "Payment method saved" };
  },
);
