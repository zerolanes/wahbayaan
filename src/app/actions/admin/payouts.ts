"use server";

import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { notifications, orders, payouts, vendorOrders, vendors } from "@/lib/db/schema";
import { applyBps, formatMoney } from "@/lib/money/currency";
import { getSettings } from "@/lib/settings";
import { reference } from "@/lib/ids";
import { adminAction, AdminError } from "@/lib/admin/action";
import { zIds, zOptStr, zUuid } from "@/lib/admin/zod";

const OPS = ["schedule", "paid", "hold", "unhold", "failed"] as const;
const NEXT: Record<(typeof OPS)[number], { status: "scheduled" | "paid" | "on_hold" | "pending" | "failed"; from: string[] }> = {
  schedule: { status: "scheduled", from: ["pending"] },
  paid: { status: "paid", from: ["pending", "scheduled"] },
  hold: { status: "on_hold", from: ["pending", "scheduled"] },
  unhold: { status: "pending", from: ["on_hold", "failed"] },
  failed: { status: "failed", from: ["scheduled"] },
};

export const bulkPayoutsAction = adminAction(
  "payouts.manage",
  z.object({ op: z.enum(OPS), ids: zIds, reference: zOptStr(120), method: zOptStr(60) }),
  async ({ data, audit }) => {
    if (!data.ids.length) throw new AdminError("Select at least one payout.");
    if (data.op === "paid" && !data.reference) throw new AdminError("Enter the bank transfer reference to mark payouts as paid.");
    const d = await db();
    const rule = NEXT[data.op];
    const rows = await d.select().from(payouts).where(inArray(payouts.id, data.ids));
    const eligible = rows.filter((r) => rule.from.includes(r.status));
    if (!eligible.length) throw new AdminError(`None of the selected payouts can be moved to “${rule.status.replace("_", " ")}”.`);
    const batch = data.op === "schedule" ? reference(`BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`, 4) : null;
    await d
      .update(payouts)
      .set({
        status: rule.status,
        ...(data.op === "paid" ? { paidAt: new Date(), reference: data.reference, method: data.method ?? "bank_transfer" } : {}),
        ...(batch ? { reference: batch } : {}),
      })
      .where(inArray(payouts.id, eligible.map((r) => r.id)));
    if (data.op === "paid") {
      const vs = await d.select().from(vendors).where(inArray(vendors.id, [...new Set(eligible.map((r) => r.vendorId))]));
      for (const v of vs) {
        const sum = eligible.filter((r) => r.vendorId === v.id).reduce((a, r) => a + r.amountPkr, 0);
        await d.insert(notifications).values({ userId: v.userId, kind: "payout", title: `Payout sent: ${formatMoney(sum, "PKR")}`, body: `Reference ${data.reference}`, link: "/seller/payouts" });
      }
    }
    const total = eligible.reduce((a, r) => a + r.amountPkr, 0);
    await audit({
      action: `payout.${data.op}`,
      entity: "payout",
      summary: `${data.op === "paid" ? "Marked paid" : data.op === "schedule" ? `Scheduled batch ${batch}` : `Set ${rule.status.replace("_", " ")}`}: ${eligible.length} payout(s), ${formatMoney(total, "PKR")}`,
      data: { ids: eligible.map((r) => r.id), reference: data.reference ?? batch },
    });
    const skipped = rows.length - eligible.length;
    return { message: `${eligible.length} payout${eligible.length === 1 ? "" : "s"} updated (${formatMoney(total, "PKR")})${skipped ? ` · ${skipped} skipped` : ""}` };
  },
);

export const updatePayoutNoteAction = adminAction("payouts.manage", z.object({ id: zUuid, notes: zOptStr(1000) }), async ({ data, audit }) => {
  const d = await db();
  await d.update(payouts).set({ notes: data.notes }).where(eq(payouts.id, data.id));
  await audit({ action: "payout.note", entity: "payout", entityId: data.id, summary: "Edited payout notes" });
  return { message: "Notes saved" };
});

/**
 * Orders released before a commission rate existed have no payout yet. Once a
 * commission (default or per-artisan) is set, create the missing payouts.
 */
export const createMissingPayoutsAction = adminAction("payouts.manage", z.object({}), async ({ audit }) => {
  const d = await db();
  const s = await getSettings(["commission"]);
  const rows = await d
    .select({ vo: vendorOrders, number: orders.number, vendorBps: vendors.commissionBps })
    .from(vendorOrders)
    .innerJoin(orders, eq(orders.id, vendorOrders.orderId))
    .innerJoin(vendors, eq(vendors.id, vendorOrders.vendorId))
    .where(and(eq(orders.fundsState, "released"), isNull(vendorOrders.payoutId), ne(vendorOrders.status, "cancelled")));
  let created = 0;
  let waiting = 0;
  for (const r of rows) {
    const bps = r.vo.commissionBps ?? r.vendorBps ?? (s.commission.status === "active" ? s.commission.defaultBps : null);
    if (bps == null) {
      waiting++;
      continue;
    }
    const commissionPkr = applyBps(r.vo.subtotalPkr, bps);
    const netPkr = r.vo.subtotalPkr - commissionPkr;
    const [p] = await d.insert(payouts).values({ vendorId: r.vo.vendorId, amountPkr: netPkr, status: "pending", notes: `Order ${r.number}` }).returning();
    await d.update(vendorOrders).set({ commissionBps: bps, commissionPkr, netPkr, payoutId: p.id }).where(eq(vendorOrders.id, r.vo.id));
    created++;
  }
  await audit({ action: "payout.create_missing", entity: "payout", summary: `Created ${created} payout(s) for released orders${waiting ? `; ${waiting} still waiting for a commission rate` : ""}` });
  if (!created && waiting) throw new AdminError("The commission rate is still pending — set it in Fees & commission (or per artisan) first.");
  return { message: created ? `Created ${created} payout${created === 1 ? "" : "s"}` : "Nothing to create" };
});
