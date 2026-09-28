"use server";

import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { customRequests, notifications, orders, users, vendors } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email";
import { adminAction, AdminError } from "@/lib/admin/action";
import { zBool, zInt, zMoney, zOptStr, zStr, zUuid } from "@/lib/admin/zod";

async function loadRequest(id: string) {
  const d = await db();
  const r = await d.query.customRequests.findFirst({ where: eq(customRequests.id, id) });
  if (!r) throw new AdminError("Request not found");
  return r;
}

/** Route a commission to an artisan; they see it in their dashboard and quote from there. */
export const matchRequestAction = adminAction("requests.manage", z.object({ id: zUuid, vendorId: zUuid, note: zOptStr(1000) }), async ({ data, audit }) => {
  const r = await loadRequest(data.id);
  const d = await db();
  const v = await d.query.vendors.findFirst({ where: eq(vendors.id, data.vendorId) });
  if (!v) throw new AdminError("Artisan not found");
  if (v.status !== "verified") throw new AdminError(`${v.displayName} isn't verified yet — only verified artisans take commissions.`);
  if (["converted", "cancelled"].includes(r.status)) throw new AdminError(`This request is ${r.status}.`);
  const reassigned = r.vendorId && r.vendorId !== v.id;
  await d
    .update(customRequests)
    .set({ vendorId: v.id, ...(reassigned ? { status: "new" as const, quotePkr: null, quoteDays: null, quoteMessage: null, quotedAt: null } : {}) })
    .where(eq(customRequests.id, r.id));
  await d.insert(notifications).values({ userId: v.userId, kind: "request", title: `New commission request ${r.number}`, body: data.note ?? r.details.slice(0, 180), link: "/seller/requests" });
  const owner = await d.query.users.findFirst({ where: eq(users.id, v.userId) });
  if (owner)
    await sendEmail({
      to: owner.email,
      subject: `Commission request ${r.number} — can you make it?`,
      template: "request_matched",
      body: `Wahbayaan has matched a buyer's commission to your workshop.\n\n${r.details}${data.note ? `\n\nNote from our team: ${data.note}` : ""}\n\nPlease quote in rupees from your dashboard, or decline, within three days.`,
    });
  await audit({ action: "request.match", entity: "request", entityId: r.id, summary: `${reassigned ? "Re-matched" : "Matched"} ${r.number} to ${v.displayName}` });
  return { message: `Sent to ${v.displayName}` };
});

export const requestStatusAction = adminAction(
  "requests.manage",
  z.object({ id: zUuid, status: z.enum(["new", "quoted", "accepted", "declined", "expired", "cancelled"]), reason: zOptStr(1000), notifyBuyer: zBool }),
  async ({ data, audit }) => {
    const r = await loadRequest(data.id);
    if (r.status === data.status) return { message: "No change" };
    if (data.status === "quoted" && r.quotePkr == null) throw new AdminError("Record a quote first.");
    const d = await db();
    await d.update(customRequests).set({ status: data.status }).where(eq(customRequests.id, r.id));
    if (data.notifyBuyer && ["declined", "expired", "cancelled"].includes(data.status))
      await sendEmail({
        to: r.email,
        subject: `Your commission ${r.number}`,
        template: "request_closed",
        body: `Hi ${r.name.split(" ")[0]},\n\nYour commission request ${r.number} has been ${data.status}.${data.reason ? `\n\n${data.reason}` : ""}\n\nReply to this email if you'd like us to find another artisan.`,
      });
    await audit({ action: "request.status", entity: "request", entityId: r.id, summary: `${r.number}: ${r.status} → ${data.status}${data.reason ? ` (${data.reason})` : ""}` });
    return { message: `Marked ${data.status}` };
  },
);

/** Record a quote on the artisan's behalf (e.g. agreed on a call). Amount in PKR. */
export const staffQuoteAction = adminAction(
  "requests.manage",
  z.object({ id: zUuid, quotePkr: zMoney, quoteDays: zInt(1, 365), quoteMessage: zOptStr(2000), notifyBuyer: zBool }),
  async ({ data, audit }) => {
    const r = await loadRequest(data.id);
    if (!r.vendorId) throw new AdminError("Match the request to an artisan before recording a quote.");
    if (data.quotePkr <= 0) throw new AdminError("Enter the artisan's price in rupees.");
    const d = await db();
    await d
      .update(customRequests)
      .set({ status: "quoted", quotePkr: data.quotePkr, quoteDays: data.quoteDays, quoteMessage: data.quoteMessage, quotedAt: new Date() })
      .where(eq(customRequests.id, r.id));
    if (data.notifyBuyer) {
      if (r.userId) await d.insert(notifications).values({ userId: r.userId, kind: "request", title: `Your commission ${r.number} has a quote`, link: "/account/requests" });
      await sendEmail({
        to: r.email,
        subject: `A quote for your commission ${r.number}`,
        template: "request_quoted",
        body: "The artisan has sent a quote and timeline. See it in your account — prices are shown in your currency.",
      });
    }
    await audit({ action: "request.quote", entity: "request", entityId: r.id, summary: `Recorded a quote on ${r.number}: Rs ${(data.quotePkr / 100).toLocaleString("en-PK")}, ${data.quoteDays} days` });
    return { message: "Quote recorded" };
  },
);

export const linkRequestOrderAction = adminAction("requests.manage", z.object({ id: zUuid, orderNumber: zStr(40) }), async ({ data, audit }) => {
  const r = await loadRequest(data.id);
  const d = await db();
  const o = await d.query.orders.findFirst({ where: eq(sql`upper(${orders.number})`, data.orderNumber.trim().toUpperCase()) });
  if (!o) throw new AdminError(`No order ${data.orderNumber}.`);
  await d.update(customRequests).set({ orderId: o.id, status: "converted" }).where(eq(customRequests.id, r.id));
  await audit({ action: "request.convert", entity: "request", entityId: r.id, summary: `Linked ${r.number} to order ${o.number}` });
  return { message: `Linked to ${o.number}` };
});
