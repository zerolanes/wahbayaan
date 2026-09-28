"use server";

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { orderEvents, orders, payments, refunds, vendorOrders } from "@/lib/db/schema";
import {
  cancelOrder,
  markPaid,
  ORDER_STATUS_LABEL,
  refundOrder,
  releaseFunds,
  sendQuote,
  vendorOrderAction,
} from "@/lib/commerce/orders";
import { sendEmail } from "@/lib/email";
import { adminAction, AdminError } from "@/lib/admin/action";
import { orderMoney } from "@/lib/admin/money";
import { zBool, zIds, zMoney, zOptInt, zOptMoney, zOptStr, zStr, zUuid } from "@/lib/admin/zod";
import { assertStaff } from "@/lib/auth/session";

async function loadOrder(id: string) {
  const d = await db();
  const order = await d.query.orders.findFirst({ where: eq(orders.id, id) });
  if (!order) throw new AdminError("Order not found");
  return order;
}

export const sendQuoteAction = adminAction(
  "orders.manage",
  z.object({
    orderId: zUuid,
    shipping: zMoney,
    duty: zMoney,
    importTax: zOptMoney,
    importTaxNa: zBool,
    handling: zOptMoney,
    handlingNone: zBool,
    note: zOptStr(2000),
  }),
  async ({ user, data, audit }) => {
    const order = await loadOrder(data.orderId);
    if (!data.importTaxNa && data.importTax == null) throw new AdminError("Enter the import tax, or tick “not applicable”.");
    if (!data.handlingNone && data.handling == null) throw new AdminError("Enter the handling fee, or tick “no handling fee”.");
    const q = {
      shipping: data.shipping,
      duty: data.duty,
      importTax: data.importTaxNa ? null : data.importTax,
      handling: data.handlingNone ? null : data.handling,
      note: data.note,
    };
    await sendQuote(order.id, q, user.id);
    const total = order.itemsSubtotal + q.shipping + q.duty + (q.importTax ?? 0) + (q.handling ?? 0) + (order.giftWrapAmount ?? 0) - order.discountAmount;
    await audit({ action: "order.quote", entity: "order", entityId: order.id, summary: `Sent quote for ${order.number}: ${orderMoney(total, order.currency)}`, data: q });
    return { message: `Quote sent — ${orderMoney(total, order.currency)}. The buyer was emailed.` };
  },
);

const vendorStep = z.enum(["accept", "start_production", "ready", "delivered"]);

export const vendorOrderStatusAction = adminAction(
  "orders.manage",
  z.object({ vendorOrderId: zUuid, type: vendorStep }),
  async ({ user, data, audit }) => {
    const d = await db();
    const vo = await d.query.vendorOrders.findFirst({ where: eq(vendorOrders.id, data.vendorOrderId), with: { order: true, vendor: true } });
    if (!vo) throw new AdminError("Sub-order not found");
    await vendorOrderAction(vo.id, { type: data.type }, { userId: user.id, isStaff: true });
    await audit({
      action: `vendor_order.${data.type}`,
      entity: "order",
      entityId: vo.orderId,
      summary: `Marked ${vo.vendor.displayName}'s parcel on ${vo.order.number} as ${data.type.replace(/_/g, " ")} (on behalf of the artisan)`,
    });
    return { message: "Parcel status updated" };
  },
);

export const shipVendorOrderAction = adminAction(
  "orders.manage",
  z.object({
    vendorOrderId: zUuid,
    courier: zStr(80),
    trackingNumber: zStr(80),
    trackingUrl: zOptStr(500).refine((v) => !v || /^https?:\/\//.test(v), "Tracking URL must start with http(s)://"),
    packageWeightG: zOptInt(1, 500_000),
  }),
  async ({ user, data, audit }) => {
    const d = await db();
    const vo = await d.query.vendorOrders.findFirst({ where: eq(vendorOrders.id, data.vendorOrderId), with: { order: true, vendor: true } });
    if (!vo) throw new AdminError("Sub-order not found");
    await vendorOrderAction(
      vo.id,
      { type: "ship", courier: data.courier, trackingNumber: data.trackingNumber, trackingUrl: data.trackingUrl, packageWeightG: data.packageWeightG },
      { userId: user.id, isStaff: true },
    );
    await audit({ action: "vendor_order.ship", entity: "order", entityId: vo.orderId, summary: `Added tracking ${data.courier} ${data.trackingNumber} for ${vo.vendor.displayName} on ${vo.order.number}`, data });
    return { message: "Tracking saved and buyer notified" };
  },
);

export const releaseFundsAction = adminAction(
  "escrow.release",
  z.object({ orderId: zUuid, reason: zStr(300) }),
  async ({ user, data, audit }) => {
    const order = await loadOrder(data.orderId);
    await releaseFunds(order.id, { userId: user.id, reason: `released by staff: ${data.reason}` });
    await audit({ action: "escrow.release", entity: "order", entityId: order.id, summary: `Released held funds for ${order.number} (${orderMoney(order.total, order.currency)})`, data: { reason: data.reason } });
    return { message: "Funds released — payouts were created where commission is set" };
  },
);

export const freezeFundsAction = adminAction(
  "escrow.release",
  z.object({ orderId: zUuid, op: z.enum(["freeze", "unfreeze"]), reason: zStr(300) }),
  async ({ user, data, audit }) => {
    const order = await loadOrder(data.orderId);
    const d = await db();
    if (data.op === "freeze") {
      if (order.fundsState !== "held") throw new AdminError("Only held funds can be frozen.");
      await d.update(orders).set({ fundsState: "frozen" }).where(eq(orders.id, order.id));
    } else {
      if (order.fundsState !== "frozen") throw new AdminError("These funds aren't frozen.");
      await d.update(orders).set({ fundsState: "held" }).where(eq(orders.id, order.id));
    }
    await d.insert(orderEvents).values({
      orderId: order.id,
      kind: data.op === "freeze" ? "funds_frozen" : "funds_unfrozen",
      message: data.op === "freeze" ? `Held funds frozen by staff: ${data.reason}` : `Funds unfrozen by staff: ${data.reason}`,
      actorUserId: user.id,
      visibleToBuyer: false,
    });
    await audit({ action: `escrow.${data.op}`, entity: "order", entityId: order.id, summary: `${data.op === "freeze" ? "Froze" : "Unfroze"} funds on ${order.number}`, data: { reason: data.reason } });
    return { message: data.op === "freeze" ? "Funds frozen — auto-release is paused" : "Funds unfrozen" };
  },
);

export const refundAction = adminAction(
  "orders.refund",
  z.object({ orderId: zUuid, mode: z.enum(["full", "partial"]), amount: zOptMoney, reason: zStr(300) }),
  async ({ user, data, audit }) => {
    const d = await db();
    const order = await d.query.orders.findFirst({ where: eq(orders.id, data.orderId), with: { refunds: true } });
    if (!order) throw new AdminError("Order not found");
    if (order.paymentStatus !== "paid" && order.paymentStatus !== "partially_refunded") throw new AdminError("Only paid orders can be refunded.");
    const refunded = order.refunds.filter((r) => r.status === "processed").reduce((a, r) => a + r.amount, 0);
    const amount = data.mode === "full" ? order.total - refunded : data.amount;
    if (!amount || amount <= 0) throw new AdminError("Enter the amount to refund.");
    await refundOrder(order.id, amount, data.reason, { userId: user.id });
    await audit({ action: "order.refund", entity: "order", entityId: order.id, summary: `Refunded ${orderMoney(amount, order.currency)} on ${order.number}`, data: { reason: data.reason, mode: data.mode } });
    return { message: `Refunded ${orderMoney(amount, order.currency)}` };
  },
);

export const cancelOrderAction = adminAction(
  "orders.manage",
  z.object({ orderId: zUuid, reason: zStr(300) }),
  async ({ user, data, audit }) => {
    const order = await loadOrder(data.orderId);
    if (order.paymentStatus === "paid") {
      const u = await assertStaff("orders.refund").catch(() => null);
      if (!u) throw new AdminError("This order is paid — cancelling refunds the buyer, which needs the orders.refund permission.");
    }
    await cancelOrder(order.id, { userId: user.id, reason: data.reason, isStaff: true });
    await audit({ action: "order.cancel", entity: "order", entityId: order.id, summary: `Cancelled ${order.number}`, data: { reason: data.reason, refunded: order.paymentStatus === "paid" } });
    return { message: order.paymentStatus === "paid" ? "Order cancelled and refunded" : "Order cancelled" };
  },
);

export const recordPaymentAction = adminAction(
  "orders.manage",
  z.object({ orderId: zUuid, method: zStr(60), reference: zStr(120) }),
  async ({ data, audit }) => {
    const order = await loadOrder(data.orderId);
    if (!order.totalComplete || !["quote_sent", "awaiting_payment"].includes(order.status)) throw new AdminError("Only orders with a confirmed total that are awaiting payment can be marked paid.");
    const d = await db();
    const ref = `manual_${data.reference}`;
    await d.insert(payments).values({ orderId: order.id, provider: `manual (${data.method})`, providerRef: ref, amount: order.total, currency: order.currency, status: "pending", mode: "manual" });
    await markPaid(order.id, ref);
    await audit({ action: "order.record_payment", entity: "order", entityId: order.id, summary: `Recorded a ${data.method} payment of ${orderMoney(order.total, order.currency)} for ${order.number}`, data });
    return { message: "Payment recorded — funds are now held" };
  },
);

const TEMPLATES = ["status", "quote", "custom"] as const;

export const resendEmailAction = adminAction(
  "orders.manage",
  z.object({ orderId: zUuid, template: z.enum(TEMPLATES), subject: zOptStr(200), message: zOptStr(5000) }),
  async ({ data, audit }) => {
    const order = await loadOrder(data.orderId);
    const status = ORDER_STATUS_LABEL[order.status] ?? order.status;
    let subject: string;
    let body: string;
    if (data.template === "quote") {
      if (!order.totalComplete) throw new AdminError("This order has no confirmed total yet — send a quote first.");
      subject = `Your final total for order ${order.number}`;
      body = `Shipping and import costs for your order are confirmed. Total: ${orderMoney(order.total, order.currency)}. Approve and pay from your order page.${order.quoteNote ? `\n\nNote from our team: ${order.quoteNote}` : ""}`;
    } else if (data.template === "custom") {
      if (!data.message) throw new AdminError("Write the message to send.");
      subject = data.subject ?? `About your Wahbayaan order ${order.number}`;
      body = data.message;
    } else {
      subject = `Update on your Wahbayaan order ${order.number}`;
      body = `Hello ${order.customerName},\n\nYour order ${order.number} is: ${status}.\nTotal: ${order.totalComplete ? orderMoney(order.total, order.currency) : "being confirmed by our team"}.\n\nYou can follow every step from your order page.`;
    }
    const res = await sendEmail({ to: order.email, subject, body, template: `admin_${data.template}` });
    await audit({ action: "order.email", entity: "order", entityId: order.id, summary: `Emailed ${order.email} (${data.template}) about ${order.number}`, data: { subject } });
    return { message: res.sent ? "Email sent" : "Email recorded in the outbox (sending isn't configured)" };
  },
);

export const timelineUpdateAction = adminAction(
  "orders.manage",
  z.object({ orderId: zUuid, message: zStr(1000), visibleToBuyer: zBool }),
  async ({ user, data, audit }) => {
    const order = await loadOrder(data.orderId);
    const d = await db();
    await d.insert(orderEvents).values({ orderId: order.id, kind: "staff_update", message: data.message, actorUserId: user.id, visibleToBuyer: data.visibleToBuyer });
    await audit({ action: "order.timeline", entity: "order", entityId: order.id, summary: `Posted a ${data.visibleToBuyer ? "buyer-visible" : "internal"} update on ${order.number}` });
    return { message: data.visibleToBuyer ? "Update posted to the buyer's timeline" : "Internal event added" };
  },
);

export const updateAddressAction = adminAction(
  "orders.manage",
  z.object({
    orderId: zUuid,
    fullName: zStr(120),
    line1: zStr(200),
    line2: zOptStr(200),
    city: zStr(120),
    region: zOptStr(120),
    postalCode: zOptStr(40),
    phone: zOptStr(40),
  }),
  async ({ data, audit }) => {
    const d = await db();
    const order = await d.query.orders.findFirst({ where: eq(orders.id, data.orderId), with: { vendorOrders: true } });
    if (!order) throw new AdminError("Order not found");
    if (order.vendorOrders.some((v) => v.status === "shipped" || v.status === "delivered")) throw new AdminError("A parcel has already shipped — the address can't change now.");
    const { orderId: _id, ...addr } = data;
    const next = { ...order.shippingAddress, ...addr, country: order.shippingAddress.country };
    await d.update(orders).set({ shippingAddress: next }).where(eq(orders.id, order.id));
    await audit({ action: "order.address", entity: "order", entityId: order.id, summary: `Edited the shipping address on ${order.number}`, data: { before: order.shippingAddress, after: next } });
    return { message: "Shipping address updated" };
  },
);

export const updateGiftAction = adminAction(
  "orders.manage",
  z.object({ orderId: zUuid, isGift: zBool, giftMessage: zOptStr(500) }),
  async ({ data, audit }) => {
    const order = await loadOrder(data.orderId);
    const d = await db();
    await d.update(orders).set({ isGift: data.isGift, giftMessage: data.isGift ? data.giftMessage : null }).where(eq(orders.id, order.id));
    await audit({ action: "order.gift", entity: "order", entityId: order.id, summary: `Updated gift details on ${order.number}`, data: { before: order.giftMessage, after: data.giftMessage } });
    return { message: "Gift details updated" };
  },
);

export const bulkOrdersAction = adminAction(
  "orders.view",
  z.object({ op: z.enum(["email_status", "release"]), ids: zIds }),
  async ({ user, data, audit }) => {
    if (!data.ids.length) throw new AdminError("Select at least one order.");
    const d = await db();
    const rows = await d.select().from(orders).where(inArray(orders.id, data.ids));
    let done = 0;
    const skipped: string[] = [];
    if (data.op === "email_status") {
      await assertStaff("orders.manage").catch(() => {
        throw new AdminError("Emailing buyers needs the orders.manage permission.");
      });
      for (const o of rows) {
        await sendEmail({
          to: o.email,
          subject: `Update on your Wahbayaan order ${o.number}`,
          template: "admin_status",
          body: `Hello ${o.customerName},\n\nYour order ${o.number} is: ${ORDER_STATUS_LABEL[o.status] ?? o.status}.`,
        });
        done++;
      }
    } else {
      await assertStaff("escrow.release").catch(() => {
        throw new AdminError("Releasing funds needs the escrow.release permission.");
      });
      for (const o of rows) {
        if (o.fundsState !== "held" || o.status !== "delivered") {
          skipped.push(o.number);
          continue;
        }
        await releaseFunds(o.id, { userId: user.id, reason: "released by staff (bulk)" });
        done++;
      }
    }
    await audit({ action: `order.bulk_${data.op}`, entity: "order", summary: `Bulk ${data.op.replace("_", " ")} on ${done} order(s)`, data: { ids: data.ids, skipped } });
    return { message: `${done} order${done === 1 ? "" : "s"} updated${skipped.length ? ` · skipped ${skipped.join(", ")} (not delivered with held funds)` : ""}` };
  },
);

/** Mark an individual refund row as processed/rejected (for requested refunds). */
export const updateRefundStatusAction = adminAction(
  "orders.refund",
  z.object({ refundId: zUuid, status: z.enum(["rejected"]) }),
  async ({ data, audit }) => {
    const d = await db();
    const r = await d.query.refunds.findFirst({ where: and(eq(refunds.id, data.refundId), eq(refunds.status, "requested")) });
    if (!r) throw new AdminError("Only requested refunds can be rejected.");
    await d.update(refunds).set({ status: data.status }).where(eq(refunds.id, r.id));
    await audit({ action: "refund.reject", entity: "order", entityId: r.orderId, summary: `Rejected a refund request of ${orderMoney(r.amount, r.currency)}` });
    return { message: "Refund request rejected" };
  },
);

export const bulkShipmentsAction = adminAction(
  "orders.manage",
  z.object({ op: z.enum(["delivered"]), ids: zIds }),
  async ({ user, data, audit }) => {
    if (!data.ids.length) throw new AdminError("Select at least one parcel.");
    const d = await db();
    const rows = await d.query.vendorOrders.findMany({ where: inArray(vendorOrders.id, data.ids), with: { order: true } });
    let done = 0;
    const failed: string[] = [];
    for (const vo of rows) {
      if (vo.status !== "shipped") {
        failed.push(vo.order.number);
        continue;
      }
      try {
        await vendorOrderAction(vo.id, { type: "delivered" }, { userId: user.id, isStaff: true });
        done++;
      } catch {
        failed.push(vo.order.number);
      }
    }
    await audit({ action: "vendor_order.bulk_delivered", entity: "order", summary: `Marked ${done} parcel(s) delivered`, data: { ids: data.ids, failed } });
    return { message: `${done} parcel${done === 1 ? "" : "s"} marked delivered${failed.length ? ` · skipped ${failed.join(", ")}` : ""}` };
  },
);
