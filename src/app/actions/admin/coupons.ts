"use server";

import { redirect } from "next/navigation";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { coupons, orders } from "@/lib/db/schema";
import { adminAction, AdminError } from "@/lib/admin/action";
import { describeCoupon, normalizeCouponCode, validateCoupon } from "@/lib/admin/coupons";
import { zBool, zOptBps, zOptInt, zOptMoney, zOptStr, zStr, zUuid } from "@/lib/admin/zod";

/** `datetime-local` values are entered as UTC (the form says so). */
const zUtcDate = z.preprocess(
  (v) => (typeof v === "string" && v.trim() ? new Date(/Z$|[+-]\d\d:\d\d$/.test(v) ? v : `${v}Z`) : null),
  z.date().refine((d) => !Number.isNaN(d.getTime()), "Invalid date").nullable(),
);

const fields = z.object({
  code: zStr(40),
  description: zOptStr(300),
  kind: z.enum(["percent", "fixed"]),
  percent: zOptBps,
  amount: zOptMoney,
  currency: z.preprocess((v) => (v === "" ? null : v), z.enum(["USD", "GBP", "CAD", "PKR"]).nullable()),
  minSubtotal: zOptMoney,
  startsAt: zUtcDate,
  endsAt: zUtcDate,
  maxUses: zOptInt(1, 10_000_000),
  isActive: zBool,
});

function toRow(data: z.output<typeof fields>) {
  const row = {
    code: normalizeCouponCode(data.code),
    description: data.description,
    kind: data.kind,
    percentBps: data.kind === "percent" ? data.percent : null,
    amount: data.kind === "fixed" ? data.amount : null,
    currency: data.kind === "fixed" || (data.minSubtotal ?? 0) > 0 ? data.currency : null,
    minSubtotal: data.minSubtotal || null,
    startsAt: data.startsAt,
    endsAt: data.endsAt,
    maxUses: data.maxUses,
    isActive: data.isActive,
  };
  const problem = validateCoupon(row);
  if (problem) throw new AdminError(problem);
  return row;
}

export const createCouponAction = adminAction("marketing.manage", fields, async ({ data, audit }) => {
  const row = toRow(data);
  const d = await db();
  if (await d.query.coupons.findFirst({ where: eq(coupons.code, row.code) })) throw new AdminError(`The code ${row.code} already exists.`);
  const [c] = await d.insert(coupons).values(row).returning();
  await audit({ action: "coupon.create", entity: "coupon", entityId: c.id, summary: `Created coupon ${c.code} (${describeCoupon(c)})` });
  redirect(`/admin/coupons/${c.id}`);
});

export const updateCouponAction = adminAction("marketing.manage", fields.extend({ id: zUuid }), async ({ data, audit }) => {
  const d = await db();
  const before = await d.query.coupons.findFirst({ where: eq(coupons.id, data.id) });
  if (!before) throw new AdminError("Coupon not found");
  const row = toRow(data);
  if (row.code !== before.code) {
    if (before.usedCount > 0) throw new AdminError("This code has been used on orders — create a new coupon instead of renaming it.");
    if (await d.query.coupons.findFirst({ where: and(eq(coupons.code, row.code), ne(coupons.id, before.id)) })) throw new AdminError(`The code ${row.code} already exists.`);
  }
  await d.update(coupons).set(row).where(eq(coupons.id, before.id));
  const changed = (Object.keys(row) as (keyof typeof row)[]).filter((k) => JSON.stringify(row[k]) !== JSON.stringify(before[k]));
  await audit({ action: "coupon.update", entity: "coupon", entityId: before.id, summary: `Edited coupon ${row.code} (${changed.join(", ") || "no changes"})`, data: { changed } });
  return { message: "Coupon saved" };
});

export const toggleCouponAction = adminAction("marketing.manage", z.object({ id: zUuid }), async ({ data, audit }) => {
  const d = await db();
  const c = await d.query.coupons.findFirst({ where: eq(coupons.id, data.id) });
  if (!c) throw new AdminError("Coupon not found");
  await d.update(coupons).set({ isActive: !c.isActive }).where(eq(coupons.id, c.id));
  await audit({ action: c.isActive ? "coupon.disable" : "coupon.enable", entity: "coupon", entityId: c.id, summary: `${c.isActive ? "Disabled" : "Enabled"} coupon ${c.code}` });
  return { message: c.isActive ? `${c.code} disabled` : `${c.code} enabled` };
});

export const deleteCouponAction = adminAction("marketing.manage", z.object({ id: zUuid }), async ({ data, audit }) => {
  const d = await db();
  const c = await d.query.coupons.findFirst({ where: eq(coupons.id, data.id) });
  if (!c) throw new AdminError("Coupon not found");
  const [{ n }] = await d.select({ n: sql<number>`count(*)::int` }).from(orders).where(eq(orders.couponCode, c.code));
  if (c.usedCount > 0 || Number(n) > 0) throw new AdminError("This code appears on orders, so it's kept for the record — disable it instead.");
  await d.delete(coupons).where(eq(coupons.id, c.id));
  await audit({ action: "coupon.delete", entity: "coupon", entityId: c.id, summary: `Deleted unused coupon ${c.code}` });
  redirect("/admin/coupons");
});
