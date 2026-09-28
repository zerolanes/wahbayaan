"use server";

import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { dutyRates, fxRates, importRules, shippingRates } from "@/lib/db/schema";
import { refreshFxFromProvider } from "@/lib/commerce/fx-provider";
import { getSetting, setSetting } from "@/lib/settings";
import { formatMoney, type Currency } from "@/lib/money/currency";
import { adminAction, AdminError } from "@/lib/admin/action";
import { bpsToPercentString } from "@/lib/admin/money";
import { zBool, zIds, zInt, zOptBps, zOptInt, zOptMoney, zOptNum, zOptStr, zStr, zUuid } from "@/lib/admin/zod";

const DEST = z.enum(["US", "GB", "CA"]);
const CUR = z.enum(["PKR", "USD", "GBP", "CAD"]);
const CONFIG = z.enum(["pending", "active", "disabled"]);

// ── FX ──────────────────────────────────────────────────────────────────────

export const saveFxRateAction = adminAction(
  "rates.manage",
  z.object({ currency: z.enum(["USD", "GBP", "CAD"]), pkrPerUnit: z.coerce.number().min(1, "PKR per unit must be at least 1").max(10_000, "That rate looks wrong"), source: zOptStr(200) }),
  async ({ user, data, audit }) => {
    const d = await db();
    const before = await d.query.fxRates.findFirst({ where: eq(fxRates.currency, data.currency) });
    const source = data.source ?? `Manual — set by ${user.name} on ${new Date().toISOString().slice(0, 10)}`;
    const value = data.pkrPerUnit.toFixed(4);
    await d
      .insert(fxRates)
      .values({ currency: data.currency, pkrPerUnit: value, source, status: "manual" })
      .onConflictDoUpdate({ target: fxRates.currency, set: { pkrPerUnit: value, source, status: "manual", updatedAt: new Date() } });
    await audit({
      action: "fx.update",
      entity: "fx_rate",
      entityId: data.currency,
      summary: `Set ${data.currency} to ${Number(value)} PKR (was ${before ? `${Number(before.pkrPerUnit)} · ${before.status}` : "unset"})`,
      data: { before: before ? { pkrPerUnit: before.pkrPerUnit, status: before.status, source: before.source } : null, after: { pkrPerUnit: value, source } },
    });
    return { message: `${data.currency} saved as a manual rate` };
  },
);

export const refreshFxAction = adminAction("rates.manage", z.object({}), async ({ audit }) => {
  const d = await db();
  const before = await d.select().from(fxRates);
  const res = await refreshFxFromProvider();
  if (!res.ok) {
    await audit({ action: "fx.refresh_failed", entity: "fx_rate", summary: `FX refresh failed: ${res.error}` });
    throw new AdminError(`${res.error}. Existing rates were left unchanged.`);
  }
  await audit({
    action: "fx.refresh",
    entity: "fx_rate",
    summary: `Refreshed FX from provider: ${Object.entries(res.rates).map(([c, r]) => `${c} ${r.toFixed(2)}`).join(", ")}`,
    data: { before: before.map((b) => ({ currency: b.currency, pkrPerUnit: b.pkrPerUnit, status: b.status })), after: res.rates },
  });
  return { message: `Live rates stored: ${Object.entries(res.rates).map(([c, r]) => `${c} ${r.toFixed(2)}`).join(" · ")}` };
});

export const saveFxMarkupAction = adminAction("rates.manage", z.object({ markupPercent: zOptBps }), async ({ data, audit }) => {
  const before = await getSetting("fx");
  const markupBps = data.markupPercent ?? 0;
  if (markupBps > 1000) throw new AdminError("A markup above 10% is almost certainly a mistake.");
  await setSetting("fx", { markupBps });
  await audit({ action: "setting.fx", entity: "setting", entityId: "fx", summary: `FX markup ${bpsToPercentString(before.markupBps) || 0}% → ${bpsToPercentString(markupBps) || 0}%` });
  return { message: "FX markup saved" };
});

// ── Shipping ────────────────────────────────────────────────────────────────

export const saveShippingRateAction = adminAction(
  "rates.manage",
  z.object({
    id: zUuid,
    serviceName: zOptStr(80),
    amount: zOptMoney,
    currency: CUR,
    transitDaysMin: zOptInt(0, 120),
    transitDaysMax: zOptInt(0, 120),
    status: CONFIG,
    source: zOptStr(200),
    notes: zOptStr(500),
  }),
  async ({ data, audit }) => {
    const d = await db();
    const r = await d.query.shippingRates.findFirst({ where: eq(shippingRates.id, data.id) });
    if (!r) throw new AdminError("Rate not found");
    if (data.status === "active" && data.amount == null) throw new AdminError("Enter the contracted amount before activating this band.");
    if (data.transitDaysMin != null && data.transitDaysMax != null && data.transitDaysMin > data.transitDaysMax) throw new AdminError("Transit min is greater than max.");
    const { id: _id, ...patch } = data;
    await d.update(shippingRates).set(patch).where(eq(shippingRates.id, r.id));
    await audit({
      action: "shipping_rate.update",
      entity: "shipping_rate",
      entityId: r.id,
      summary: `${r.courier} → ${r.destinationCountry} ${r.minWeightG / 1000}–${r.maxWeightG / 1000} kg: ${data.amount == null ? "no amount" : formatMoney(data.amount, data.currency as Currency)} (${data.status})`,
      data: { before: { amount: r.amount, currency: r.currency, status: r.status }, after: patch },
    });
    return { message: "Rate saved" };
  },
);

export const addShippingBandAction = adminAction(
  "rates.manage",
  z.object({ courier: zStr(80), destinationCountry: DEST, minKg: z.coerce.number().min(0).max(1000), maxKg: z.coerce.number().min(0.01).max(1000), currency: CUR, amount: zOptMoney }),
  async ({ data, audit }) => {
    if (data.maxKg <= data.minKg) throw new AdminError("Max weight must be above min weight.");
    const d = await db();
    const [r] = await d
      .insert(shippingRates)
      .values({ courier: data.courier, destinationCountry: data.destinationCountry, minWeightG: Math.round(data.minKg * 1000), maxWeightG: Math.round(data.maxKg * 1000), currency: data.currency, amount: data.amount, status: "pending", notes: "Added in admin — activate once the contracted amount is confirmed." })
      .returning();
    await audit({ action: "shipping_rate.create", entity: "shipping_rate", entityId: r.id, summary: `Added ${data.courier} band ${data.minKg}–${data.maxKg} kg to ${data.destinationCountry}` });
    return { message: "Weight band added (pending until activated)" };
  },
);

export const deleteShippingRateAction = adminAction("rates.manage", z.object({ id: zUuid }), async ({ data, audit }) => {
  const d = await db();
  const r = await d.query.shippingRates.findFirst({ where: eq(shippingRates.id, data.id) });
  if (!r) throw new AdminError("Rate not found");
  await d.delete(shippingRates).where(eq(shippingRates.id, r.id));
  await audit({ action: "shipping_rate.delete", entity: "shipping_rate", entityId: r.id, summary: `Deleted ${r.courier} → ${r.destinationCountry} band ${r.minWeightG / 1000}–${r.maxWeightG / 1000} kg`, data: r });
  return { message: "Band deleted" };
});

export const bulkShippingAction = adminAction("rates.manage", z.object({ op: CONFIG, ids: zIds }), async ({ data, audit }) => {
  if (!data.ids.length) throw new AdminError("Select at least one band.");
  const d = await db();
  const rows = await d.select().from(shippingRates).where(inArray(shippingRates.id, data.ids));
  const ok = data.op === "active" ? rows.filter((r) => r.amount != null) : rows;
  if (ok.length) await d.update(shippingRates).set({ status: data.op }).where(inArray(shippingRates.id, ok.map((r) => r.id)));
  await audit({ action: `shipping_rate.bulk_${data.op}`, entity: "shipping_rate", summary: `Set ${ok.length} shipping band(s) to ${data.op}`, data: { ids: ok.map((r) => r.id) } });
  const skipped = rows.length - ok.length;
  return { message: `${ok.length} band${ok.length === 1 ? "" : "s"} set to ${data.op}${skipped ? ` · ${skipped} skipped (no amount entered)` : ""}` };
});

// ── Duty ────────────────────────────────────────────────────────────────────

const hs = zOptStr(20).refine((v) => !v || /^[0-9.]{4,14}$/.test(v), "HS codes are digits and dots, e.g. 5701.10");

export const saveDutyRateAction = adminAction(
  "rates.manage",
  z.object({
    id: zUuid,
    hsCode: hs,
    dutyPercent: zOptNum(0, 100),
    taxPercent: zOptNum(0, 100),
    taxLabel: zOptStr(40),
    deMinimisAmount: zOptMoney,
    deMinimisCurrency: z.enum(["", "USD", "GBP", "CAD", "PKR"]).optional(),
    basis: z.enum(["item", "item_plus_shipping"]),
    status: CONFIG,
    source: zOptStr(300),
    notes: zOptStr(1000),
  }),
  async ({ data, audit }) => {
    const d = await db();
    const r = await d.query.dutyRates.findFirst({ where: eq(dutyRates.id, data.id), with: { category: true } });
    if (!r) throw new AdminError("Duty row not found");
    if (data.status === "active" && data.dutyPercent == null) throw new AdminError("Enter the duty % (0 if duty-free) before activating.");
    if (data.status === "active" && !data.source) throw new AdminError("Record where this rate came from (broker name / tariff reference) before activating.");
    if (data.deMinimisAmount != null && !data.deMinimisCurrency) throw new AdminError("Pick the currency of the de minimis threshold.");
    const patch = {
      hsCode: data.hsCode,
      dutyPercent: data.dutyPercent == null ? null : String(data.dutyPercent),
      taxPercent: data.taxPercent == null ? null : String(data.taxPercent),
      taxLabel: data.taxLabel,
      deMinimisAmount: data.deMinimisAmount,
      deMinimisCurrency: data.deMinimisCurrency || null,
      basis: data.basis,
      status: data.status,
      source: data.source,
      notes: data.notes,
    };
    await d.update(dutyRates).set(patch).where(eq(dutyRates.id, r.id));
    await audit({
      action: "duty_rate.update",
      entity: "duty_rate",
      entityId: r.id,
      summary: `${r.destinationCountry} · ${r.category?.name ?? "all categories"}: duty ${data.dutyPercent ?? "—"}%, ${data.taxLabel ?? "tax"} ${data.taxPercent ?? "—"}% (${data.status})`,
      data: { before: { dutyPercent: r.dutyPercent, taxPercent: r.taxPercent, status: r.status, hsCode: r.hsCode }, after: patch },
    });
    return { message: "Duty row saved" };
  },
);

export const addDutyRateAction = adminAction(
  "rates.manage",
  z.object({ destinationCountry: DEST, categoryId: z.string().optional(), hsCode: hs }),
  async ({ data, audit }) => {
    const d = await db();
    const [r] = await d
      .insert(dutyRates)
      .values({ destinationCountry: data.destinationCountry, categoryId: data.categoryId || null, hsCode: data.hsCode, status: "pending", basis: "item_plus_shipping", notes: "Pending — confirm with a customs broker." })
      .returning();
    await audit({ action: "duty_rate.create", entity: "duty_rate", entityId: r.id, summary: `Added duty row for ${data.destinationCountry}${data.hsCode ? ` · HS ${data.hsCode}` : ""}` });
    return { message: "Duty row added (pending)" };
  },
);

export const deleteDutyRateAction = adminAction("rates.manage", z.object({ id: zUuid }), async ({ data, audit }) => {
  const d = await db();
  const r = await d.query.dutyRates.findFirst({ where: eq(dutyRates.id, data.id) });
  if (!r) throw new AdminError("Duty row not found");
  await d.delete(dutyRates).where(eq(dutyRates.id, r.id));
  await audit({ action: "duty_rate.delete", entity: "duty_rate", entityId: r.id, summary: `Deleted a duty row for ${r.destinationCountry}`, data: r });
  return { message: "Duty row deleted" };
});

// ── Import rules ────────────────────────────────────────────────────────────

const ruleFields = { destinationCountry: DEST, categoryId: z.string().optional(), level: z.enum(["info", "warning", "restricted", "prohibited"]), message: zStr(1000), status: CONFIG, source: zOptStr(300) };

export const saveImportRuleAction = adminAction("rates.manage", z.object({ id: z.string().optional(), ...ruleFields }), async ({ data, audit }) => {
  const d = await db();
  const values = { destinationCountry: data.destinationCountry, categoryId: data.categoryId || null, level: data.level, message: data.message, status: data.status, source: data.source };
  if (data.id) {
    const before = await d.query.importRules.findFirst({ where: eq(importRules.id, data.id) });
    if (!before) throw new AdminError("Rule not found");
    await d.update(importRules).set(values).where(eq(importRules.id, data.id));
    await audit({ action: "import_rule.update", entity: "import_rule", entityId: data.id, summary: `Edited ${data.level} import rule for ${data.destinationCountry} (${data.status})`, data: { before: { level: before.level, message: before.message, status: before.status, source: before.source, categoryId: before.categoryId }, after: values } });
    return { message: "Rule saved" };
  }
  const [r] = await d.insert(importRules).values(values).returning();
  await audit({ action: "import_rule.create", entity: "import_rule", entityId: r.id, summary: `Added ${data.level} import rule for ${data.destinationCountry}` });
  return { message: "Rule added" };
});

export const deleteImportRuleAction = adminAction("rates.manage", z.object({ id: zUuid }), async ({ data, audit }) => {
  const d = await db();
  const r = await d.query.importRules.findFirst({ where: eq(importRules.id, data.id) });
  if (!r) throw new AdminError("Rule not found");
  await d.delete(importRules).where(eq(importRules.id, data.id));
  await audit({ action: "import_rule.delete", entity: "import_rule", entityId: data.id, summary: `Deleted a ${r.level} import rule for ${r.destinationCountry}`, data: { before: r } });
  return { message: "Rule deleted" };
});

// ── Fees & business settings ────────────────────────────────────────────────

export const saveHandlingFeeAction = adminAction(
  "rates.manage",
  z.object({ mode: z.enum(["pending", "none", "fixed", "percent"]), amount: zOptMoney, currency: CUR.optional(), percent: zOptBps }),
  async ({ data, audit }) => {
    const before = await getSetting("handling_fee");
    let value: Parameters<typeof setSetting<"handling_fee">>[1];
    if (data.mode === "pending") value = { status: "pending" };
    else if (data.mode === "none") value = { status: "active", kind: "percent", percentBps: 0 };
    else if (data.mode === "fixed") {
      if (data.amount == null || !data.currency) throw new AdminError("Enter the fixed fee and its currency.");
      value = { status: "active", kind: "fixed", amount: data.amount, currency: data.currency };
    } else {
      if (data.percent == null) throw new AdminError("Enter the fee percentage.");
      value = { status: "active", kind: "percent", percentBps: data.percent };
    }
    await setSetting("handling_fee", value);
    await audit({ action: "setting.handling_fee", entity: "setting", entityId: "handling_fee", summary: `Handling fee → ${describeHandling(value)}`, data: { before, after: value } });
    return { message: "Handling fee saved — new quotes use it immediately" };
  },
);

function describeHandling(v: Awaited<ReturnType<typeof getSetting<"handling_fee">>>) {
  if (v.status === "pending") return "pending";
  if (v.kind === "fixed") return `${formatMoney(v.amount, v.currency)} per order`;
  return v.percentBps ? `${v.percentBps / 100}% of items` : "none";
}

export const saveCommissionAction = adminAction("rates.manage", z.object({ mode: z.enum(["pending", "active"]), percent: zOptBps }), async ({ data, audit }) => {
  const before = await getSetting("commission");
  if (data.mode === "active" && data.percent == null) throw new AdminError("Enter the default commission %.");
  const value = data.mode === "pending" ? ({ status: "pending" } as const) : ({ status: "active", defaultBps: data.percent! } as const);
  await setSetting("commission", value);
  await audit({ action: "setting.commission", entity: "setting", entityId: "commission", summary: `Default commission → ${value.status === "active" ? `${value.defaultBps / 100}%` : "pending"}`, data: { before, after: value } });
  return { message: "Commission saved. Released orders waiting for it can now get payouts (Artisan payouts → Create payouts)." };
});

export const saveGiftWrapAction = adminAction("rates.manage", z.object({ mode: z.enum(["pending", "disabled", "active"]), amount: zOptMoney, currency: CUR.optional() }), async ({ data, audit }) => {
  const before = await getSetting("gift_wrap");
  let value: Parameters<typeof setSetting<"gift_wrap">>[1];
  if (data.mode === "active") {
    if (data.amount == null || !data.currency) throw new AdminError("Enter the gift-wrap price and currency.");
    value = { status: "active", amount: data.amount, currency: data.currency };
  } else value = { status: data.mode };
  await setSetting("gift_wrap", value);
  await audit({ action: "setting.gift_wrap", entity: "setting", entityId: "gift_wrap", summary: `Gift wrap → ${value.status === "active" ? formatMoney(value.amount, value.currency) : value.status}`, data: { before, after: value } });
  return { message: "Gift wrap saved" };
});

export const saveEscrowAction = adminAction("rates.manage", z.object({ days: zInt(1, 90), confirmed: zBool }), async ({ data, audit }) => {
  const before = await getSetting("escrow");
  const value = { autoReleaseDaysAfterDelivery: data.days, status: data.confirmed ? ("active" as const) : ("pending" as const) };
  await setSetting("escrow", value);
  await audit({ action: "setting.escrow", entity: "setting", entityId: "escrow", summary: `Escrow auto-release → ${data.days} days after delivery (${value.status})`, data: { before, after: value } });
  return { message: "Escrow period saved (applies to newly delivered orders)" };
});

export const saveBuyerProtectionAction = adminAction("rates.manage", z.object({ days: zOptInt(0, 365), confirmed: zBool }), async ({ data, audit }) => {
  const before = await getSetting("buyer_protection");
  if (data.confirmed && data.days == null) throw new AdminError("Enter the return window before confirming it.");
  const value = { returnWindowDays: data.days, status: data.confirmed ? ("active" as const) : ("pending" as const) };
  await setSetting("buyer_protection", value);
  await audit({ action: "setting.buyer_protection", entity: "setting", entityId: "buyer_protection", summary: `Buyer protection → ${data.days ?? "—"} days (${value.status})`, data: { before, after: value } });
  return { message: "Buyer protection saved" };
});


// ── Bulk status changes (duty rows, import rules) ───────────────────────────

export const bulkDutyAction = adminAction("rates.manage", z.object({ op: CONFIG, ids: zIds }), async ({ data, audit }) => {
  if (!data.ids.length) throw new AdminError("Select at least one duty row.");
  const d = await db();
  const rows = await d.select().from(dutyRates).where(inArray(dutyRates.id, data.ids));
  // Activating needs a real duty % and a recorded source — the same rule as the single-row form.
  const ok = data.op === "active" ? rows.filter((r) => r.dutyPercent != null && !!r.source) : rows;
  if (ok.length) await d.update(dutyRates).set({ status: data.op }).where(inArray(dutyRates.id, ok.map((r) => r.id)));
  await audit({ action: `duty_rate.bulk_${data.op}`, entity: "duty_rate", summary: `Set ${ok.length} duty row(s) to ${data.op}`, data: { ids: ok.map((r) => r.id), before: rows.map((r) => ({ id: r.id, status: r.status })) } });
  const skipped = rows.length - ok.length;
  return { message: `${ok.length} row${ok.length === 1 ? "" : "s"} set to ${data.op}${skipped ? ` · ${skipped} skipped (duty % or source missing)` : ""}` };
});

export const bulkImportRulesAction = adminAction("rates.manage", z.object({ op: CONFIG, ids: zIds }), async ({ data, audit }) => {
  if (!data.ids.length) throw new AdminError("Select at least one rule.");
  const d = await db();
  const rows = await d.select().from(importRules).where(inArray(importRules.id, data.ids));
  if (rows.length) await d.update(importRules).set({ status: data.op }).where(inArray(importRules.id, rows.map((r) => r.id)));
  await audit({ action: `import_rule.bulk_${data.op}`, entity: "import_rule", summary: `Set ${rows.length} import rule(s) to ${data.op}`, data: { ids: rows.map((r) => r.id), before: rows.map((r) => ({ id: r.id, status: r.status })) } });
  return { message: `${rows.length} rule${rows.length === 1 ? "" : "s"} set to ${data.op}` };
});
