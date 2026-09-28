import "server-only";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { db, type Db } from "@/lib/db/client";
import {
  cartItems,
  carts,
  certificates,
  coupons,
  disputeMessages,
  disputes,
  notifications,
  orderEvents,
  orderItems,
  orders,
  payments,
  payouts,
  products,
  refunds,
  vendorOrders,
  vendors,
  type OrderAddress,
} from "@/lib/db/schema";
import { getBuyerContext } from "@/lib/buyer-context";
import { getSettings } from "@/lib/settings";
import { sendEmail } from "@/lib/email";
import { reference } from "@/lib/ids";
import { formatMoney, type Currency } from "@/lib/money/currency";
import { applyBps } from "@/lib/money/currency";
import { refundPayment, startCheckout } from "@/lib/payments";
import type { CartView } from "./cart";

/**
 * Order lifecycle — the single state machine used by the storefront, the
 * artisan dashboard and the company admin.
 *
 *   awaiting_quote ─(staff quote)→ quote_sent ─┐
 *   awaiting_payment ──────────────────────────┴─(buyer pays)→ paid [funds held]
 *   paid → in_fulfilment (artisan accepts / starts making) → shipped → delivered
 *   delivered ─(buyer confirms or protection window ends)→ completed [funds released → payouts]
 *   any paid state ─(buyer opens a case)→ disputed [funds frozen] ─(staff resolves)→ refunded | completed | in_fulfilment
 *   before shipping ─(cancel)→ cancelled [refunded if paid]
 */

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Executor = Db | Tx;

export class OrderError extends Error {}

async function event(x: Executor, orderId: string, kind: string, message: string, opts: { actorUserId?: string | null; vendorOrderId?: string | null; visibleToBuyer?: boolean } = {}) {
  await x.insert(orderEvents).values({
    orderId,
    kind,
    message,
    actorUserId: opts.actorUserId ?? null,
    vendorOrderId: opts.vendorOrderId ?? null,
    visibleToBuyer: opts.visibleToBuyer ?? true,
  });
}

async function notify(x: Executor, userId: string | null | undefined, n: { kind: string; title: string; body?: string; link?: string }) {
  if (!userId) return;
  await x.insert(notifications).values({ userId, ...n });
}

async function notifyVendors(x: Executor, orderId: string, n: { kind: string; title: string; body?: string; link?: string }) {
  const rows = await x.select({ userId: vendors.userId }).from(vendorOrders).innerJoin(vendors, eq(vendors.id, vendorOrders.vendorId)).where(eq(vendorOrders.orderId, orderId));
  for (const r of rows) await notify(x, r.userId, n);
}

export async function getOrderByNumber(number: string) {
  const d = await db();
  return d.query.orders.findFirst({
    where: eq(orders.number, number),
    with: { items: true, vendorOrders: { with: { vendor: true } }, events: true, payments: true, refunds: true, disputes: true },
  });
}

// ── Placement ───────────────────────────────────────────────────────────────

export type PlaceOrderInput = {
  cart: CartView;
  userId: string | null;
  email: string;
  customerName: string;
  address: OrderAddress;
  buyerNotes?: string | null;
  referralCode?: string | null;
};

export async function placeOrder(input: PlaceOrderInput) {
  const ctx = await getBuyerContext();
  const { cart } = input;
  if (!ctx.fx) throw new OrderError("Prices can't be shown in your currency yet. Please try again later.");
  if (!cart.cartId || !cart.landed) throw new OrderError("Your cart is empty.");
  const unavailable = cart.lines.filter((l) => l.unavailableReason);
  if (unavailable.length) throw new OrderError(`Please remove unavailable items first: ${unavailable.map((l) => l.title).join(", ")}.`);
  if (input.address.country !== ctx.destination)
    throw new OrderError("The delivery address must be in the country your estimate was calculated for. Change the destination at the top of the cart.");

  const landed = cart.landed;
  const line = (key: string) => landed.lines.find((l) => l.key === key);
  const statusOf = (key: string) => {
    const l = line(key);
    return (l?.status ?? "not_applicable") as "known" | "pending" | "not_applicable";
  };
  const amountOf = (key: string) => line(key)?.amount ?? null;
  const s = await getSettings(["commission"]);

  const d = await db();
  const number = reference("WB");
  const result = await d.transaction(async (tx) => {
    const [order] = await tx
      .insert(orders)
      .values({
        number,
        userId: input.userId,
        email: input.email,
        customerName: input.customerName,
        currency: ctx.currency,
        fxPkrPerUnit: String(ctx.fx!.pkrPerUnit),
        fxSource: `${ctx.fx!.source} (${ctx.fx!.status})`,
        destinationCountry: ctx.destination,
        shippingAddress: input.address,
        status: landed.complete ? "awaiting_payment" : "awaiting_quote",
        itemsSubtotal: landed.itemsSubtotal,
        shippingAmount: amountOf("shipping"),
        shippingStatus: statusOf("shipping"),
        dutyAmount: amountOf("duty"),
        dutyStatus: statusOf("duty"),
        importTaxAmount: amountOf("import_tax"),
        importTaxStatus: statusOf("import_tax"),
        handlingAmount: amountOf("handling"),
        handlingStatus: statusOf("handling"),
        giftWrapAmount: amountOf("gift_wrap"),
        discountAmount: Math.abs(amountOf("discount") ?? 0),
        total: landed.knownTotal,
        totalComplete: landed.complete,
        couponCode: cart.couponError ? null : cart.couponCode,
        referralCode: input.referralCode ?? null,
        isGift: cart.isGift,
        giftWrap: cart.isGift && cart.giftWrap,
        giftMessage: cart.isGift ? cart.giftMessage : null,
        buyerNotes: input.buyerNotes ?? null,
      })
      .returning();

    const byVendor = new Map<string, typeof cart.lines>();
    for (const l of cart.lines) byVendor.set(l.vendorId, [...(byVendor.get(l.vendorId) ?? []), l]);
    const vendorRows = await tx.select().from(vendors).where(inArray(vendors.id, [...byVendor.keys()]));

    for (const [vendorId, lines] of byVendor) {
      const subtotalPkr = lines.reduce((a, l) => a + l.unitPricePkr * l.qty, 0);
      const vendor = vendorRows.find((v) => v.id === vendorId)!;
      const bps = vendor.commissionBps ?? (s.commission.status === "active" ? s.commission.defaultBps : null);
      const commissionPkr = bps == null ? null : applyBps(subtotalPkr, bps);
      const [vo] = await tx
        .insert(vendorOrders)
        .values({
          orderId: order.id,
          vendorId,
          subtotalPkr,
          commissionBps: bps,
          commissionPkr,
          netPkr: commissionPkr == null ? null : subtotalPkr - commissionPkr,
        })
        .returning();
      for (const l of lines) {
        const p = await tx.query.products.findFirst({ where: eq(products.id, l.productId), with: { category: true } });
        await tx.insert(orderItems).values({
          orderId: order.id,
          vendorOrderId: vo.id,
          productId: l.productId,
          vendorId,
          title: l.title,
          imageUrl: l.imageUrl,
          hsCode: p?.hsCodeOverride ?? p?.category.hsCode ?? null,
          qty: l.qty,
          unitPricePkr: l.unitPricePkr,
          unitPrice: l.unitPrice,
          customization: l.customization,
        });
        // Reserve stock for ready-to-ship pieces so a one-of-a-kind can't sell twice.
        if (l.availability === "ready_to_ship") {
          await tx.update(products).set({ stockQty: sql`greatest(${products.stockQty} - ${l.qty}, 0)` }).where(eq(products.id, l.productId));
        }
      }
    }

    if (order.couponCode) await tx.update(coupons).set({ usedCount: sql`${coupons.usedCount} + 1` }).where(eq(coupons.code, order.couponCode));
    await tx.delete(cartItems).where(eq(cartItems.cartId, cart.cartId!));
    await tx.update(carts).set({ couponCode: null, isGift: false, giftWrap: false, giftMessage: null }).where(eq(carts.id, cart.cartId!));

    await event(tx, order.id, "placed", "Order placed");
    if (!landed.complete) {
      await event(
        tx,
        order.id,
        "awaiting_quote",
        `Our team is confirming ${landed.pendingLines.map((l) => l.label.toLowerCase()).join(", ")}. You'll approve the final total before anything is charged.`,
      );
    }
    await notify(tx, input.userId, { kind: "order", title: `Order ${number} placed`, link: `/account/orders/${number}` });
    return order;
  });

  await sendEmail({
    to: input.email,
    subject: `Your Wahbayaan order ${number}`,
    template: "order_placed",
    body: result.totalComplete
      ? `Thank you, ${input.customerName}. Your order ${number} is reserved. Total: ${formatMoney(result.total, result.currency as Currency)}.`
      : `Thank you, ${input.customerName}. Your order ${number} is reserved. We're confirming the shipping and import costs for your country and will send you the final total to approve before anything is charged.`,
  });
  return result;
}

// ── Quotes & payment ────────────────────────────────────────────────────────

export type QuoteInput = {
  shipping: number | null;
  duty: number | null;
  importTax: number | null; // null = not applicable
  handling: number | null; // null = no handling fee
  note?: string | null;
};

/** Staff confirm the pending lines of an order; the buyer then approves by paying. */
export async function sendQuote(orderId: string, q: QuoteInput, actorUserId: string) {
  const d = await db();
  const order = await d.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order) throw new OrderError("Order not found");
  if (!["awaiting_quote", "quote_sent", "awaiting_payment"].includes(order.status)) throw new OrderError("This order can no longer be re-quoted.");
  if (q.shipping == null || q.duty == null) throw new OrderError("Shipping and duty are required for a quote (enter 0 if none applies).");
  const total =
    order.itemsSubtotal + q.shipping + q.duty + (q.importTax ?? 0) + (q.handling ?? 0) + (order.giftWrapAmount ?? 0) - order.discountAmount;
  await d
    .update(orders)
    .set({
      shippingAmount: q.shipping,
      shippingStatus: "known",
      dutyAmount: q.duty,
      dutyStatus: "known",
      importTaxAmount: q.importTax,
      importTaxStatus: q.importTax == null ? "not_applicable" : "known",
      handlingAmount: q.handling,
      handlingStatus: q.handling == null ? "not_applicable" : "known",
      total,
      totalComplete: true,
      status: "quote_sent",
      quoteNote: q.note ?? null,
      quoteSentAt: new Date(),
    })
    .where(eq(orders.id, orderId));
  await event(d, orderId, "quote", `Final total confirmed: ${formatMoney(total, order.currency as Currency)}. Approve and pay to start your order.`, { actorUserId });
  await notify(d, order.userId, { kind: "quote", title: `Your quote for ${order.number} is ready`, link: `/account/orders/${order.number}` });
  await sendEmail({
    to: order.email,
    subject: `Your final total for order ${order.number}`,
    template: "quote_sent",
    body: `Shipping and import costs for your order are confirmed. Total: ${formatMoney(total, order.currency as Currency)}. Approve and pay from your order page.${q.note ? `\n\nNote from our team: ${q.note}` : ""}`,
  });
}

/** Start payment for an order whose total is complete. Returns the provider redirect URL. */
export async function beginPayment(orderNumber: string, origin: string) {
  const d = await db();
  const order = await d.query.orders.findFirst({ where: eq(orders.number, orderNumber) });
  if (!order) throw new OrderError("Order not found");
  if (!order.totalComplete || !["awaiting_payment", "quote_sent"].includes(order.status)) throw new OrderError("This order isn't ready for payment.");
  const start = await startCheckout({
    orderId: order.id,
    orderNumber: order.number,
    email: order.email,
    currency: order.currency,
    amount: order.total,
    description: `Handmade pieces from Pakistan, shipped to ${order.destinationCountry}`,
    successUrl: `${origin}/checkout/success?order=${order.number}`,
    cancelUrl: `${origin}/account/orders/${order.number}`,
  });
  await d.insert(payments).values({
    orderId: order.id,
    provider: start.provider,
    providerRef: start.providerRef,
    amount: order.total,
    currency: order.currency,
    status: "pending",
    mode: start.mode,
  });
  return start;
}

/** Called by the payment webhook (or the test simulator). Funds are now held. */
export async function markPaid(orderId: string, providerRef: string | null) {
  const d = await db();
  const order = await d.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order) throw new OrderError("Order not found");
  if (order.paymentStatus === "paid") return;
  await d.transaction(async (tx) => {
    if (providerRef) await tx.update(payments).set({ status: "succeeded" }).where(and(eq(payments.orderId, orderId), eq(payments.providerRef, providerRef)));
    await tx.update(orders).set({ status: "paid", paymentStatus: "paid", fundsState: "held", paidAt: new Date() }).where(eq(orders.id, orderId));
    await event(tx, orderId, "paid", "Payment received — held safely by Wahbayaan until your piece arrives.");
    await notifyVendors(tx, orderId, { kind: "order", title: `New paid order ${order.number}`, link: "/seller/orders" });
  });
  await sendEmail({ to: order.email, subject: `Payment received for ${order.number}`, template: "paid", body: "Your payment is held by Wahbayaan and only released to the artisan once your piece arrives." });
}

// ── Fulfilment (artisan side) ───────────────────────────────────────────────

export type VendorAction =
  | { type: "accept" }
  | { type: "start_production" }
  | { type: "ready" }
  | { type: "ship"; courier: string; trackingNumber: string; trackingUrl?: string | null; packageWeightG?: number | null }
  | { type: "delivered" };

const VENDOR_LABEL: Record<VendorAction["type"], string> = {
  accept: "The artisan accepted your order",
  start_production: "The artisan has started making your piece",
  ready: "Your piece is finished and being packed for export",
  ship: "Shipped",
  delivered: "Delivered",
};

export async function vendorOrderAction(vendorOrderId: string, action: VendorAction, actor: { userId: string; vendorId?: string | null; isStaff?: boolean }) {
  const d = await db();
  const vo = await d.query.vendorOrders.findFirst({ where: eq(vendorOrders.id, vendorOrderId), with: { order: true } });
  if (!vo) throw new OrderError("Order not found");
  if (!actor.isStaff && vo.vendorId !== actor.vendorId) throw new OrderError("Not your order");
  const order = vo.order;
  if (!["paid", "in_fulfilment", "shipped", "delivered"].includes(order.status)) throw new OrderError("This order isn't paid yet or is closed.");

  const patch: Partial<typeof vendorOrders.$inferInsert> = {};
  let message: string = VENDOR_LABEL[action.type];
  switch (action.type) {
    case "accept":
      patch.status = "accepted";
      break;
    case "start_production":
      patch.status = "in_production";
      break;
    case "ready":
      patch.status = "ready_to_ship";
      break;
    case "ship":
      if (!action.courier || !action.trackingNumber) throw new OrderError("Courier and tracking number are required.");
      Object.assign(patch, {
        status: "shipped",
        courier: action.courier,
        trackingNumber: action.trackingNumber,
        trackingUrl: action.trackingUrl ?? null,
        packageWeightG: action.packageWeightG ?? null,
        shippedAt: new Date(),
      });
      message = `Shipped with ${action.courier} — tracking ${action.trackingNumber}`;
      break;
    case "delivered":
      if (!actor.isStaff) throw new OrderError("Delivery is confirmed by the courier or our team.");
      Object.assign(patch, { status: "delivered", deliveredAt: new Date() });
      break;
  }

  // Read settings before opening the transaction: the embedded database has a
  // single connection, so a query outside `tx` inside it would deadlock.
  const { escrow } = await getSettings(["escrow"]);
  await d.transaction(async (tx) => {
    await tx.update(vendorOrders).set(patch).where(eq(vendorOrders.id, vendorOrderId));
    await event(tx, order.id, `vendor_${action.type}`, message, { actorUserId: actor.userId, vendorOrderId });
    const siblings = await tx.select().from(vendorOrders).where(eq(vendorOrders.orderId, order.id));
    const statuses = siblings.map((s) => (s.id === vendorOrderId ? patch.status ?? s.status : s.status));
    let next = order.status;
    if (statuses.every((s) => s === "delivered")) next = "delivered";
    else if (statuses.every((s) => s === "shipped" || s === "delivered")) next = "shipped";
    else if (order.status === "paid") next = "in_fulfilment";
    if (next !== order.status && order.status !== "disputed") {
      await tx
        .update(orders)
        .set({
          status: next,
          ...(next === "delivered" ? { deliveredAt: new Date(), autoReleaseAt: new Date(Date.now() + escrow.autoReleaseDaysAfterDelivery * 86_400_000) } : {}),
        })
        .where(eq(orders.id, order.id));
      if (next === "delivered")
        await event(tx, order.id, "delivered", "Delivered. Please confirm it arrived as described — or open a case if something is wrong.");
    }
    await notify(tx, order.userId, { kind: "order", title: `${order.number}: ${message}`, link: `/account/orders/${order.number}` });
  });
}

// ── Completion, escrow release & payouts ────────────────────────────────────

export async function releaseFunds(orderId: string, actor: { userId: string | null; reason: string }) {
  const d = await db();
  const order = await d.query.orders.findFirst({ where: eq(orders.id, orderId), with: { vendorOrders: true, items: true } });
  if (!order) throw new OrderError("Order not found");
  if (order.fundsState !== "held") throw new OrderError("There are no held funds to release.");
  const s = await getSettings(["commission"]);
  await d.transaction(async (tx) => {
    await tx.update(orders).set({ status: "completed", fundsState: "released", releasedAt: new Date() }).where(eq(orders.id, orderId));
    await event(tx, orderId, "released", `Funds released to the artisan (${actor.reason}).`, { actorUserId: actor.userId });
    for (const vo of order.vendorOrders) {
      const bps = vo.commissionBps ?? (s.commission.status === "active" ? s.commission.defaultBps : null);
      if (bps == null) {
        await event(tx, orderId, "payout_pending", "Artisan payout is waiting for the commission rate to be set.", { visibleToBuyer: false, vendorOrderId: vo.id });
        continue;
      }
      const commissionPkr = applyBps(vo.subtotalPkr, bps);
      const netPkr = vo.subtotalPkr - commissionPkr;
      const [payout] = await tx.insert(payouts).values({ vendorId: vo.vendorId, amountPkr: netPkr, status: "pending", notes: `Order ${order.number}` }).returning();
      await tx.update(vendorOrders).set({ commissionBps: bps, commissionPkr, netPkr, payoutId: payout.id }).where(eq(vendorOrders.id, vo.id));
    }
    await notifyVendors(tx, orderId, { kind: "payout", title: `Funds released for ${order.number}`, link: "/seller/payouts" });
  });
  await issueCertificates(orderId);
}

export async function confirmDelivery(orderNumber: string, userId: string) {
  const d = await db();
  const order = await d.query.orders.findFirst({ where: eq(orders.number, orderNumber) });
  if (!order || order.userId !== userId) throw new OrderError("Order not found");
  if (!["delivered", "shipped"].includes(order.status)) throw new OrderError("This order can't be confirmed yet.");
  await releaseFunds(order.id, { userId, reason: "buyer confirmed delivery" });
}

/** Releases funds for delivered orders whose protection window has ended. Run on a schedule. */
export async function runAutoReleases() {
  const d = await db();
  const due = await d.select().from(orders).where(and(eq(orders.status, "delivered"), eq(orders.fundsState, "held"), lt(orders.autoReleaseAt, new Date())));
  for (const o of due) await releaseFunds(o.id, { userId: null, reason: "buyer-protection window ended" });
  return due.length;
}

export async function issueCertificates(orderId: string) {
  const d = await db();
  const items = await d.query.orderItems.findMany({ where: eq(orderItems.orderId, orderId), with: { product: true } });
  for (const item of items) {
    if (item.certificateId || !item.product?.isOneOfAKind) continue;
    const vendor = await d.query.vendors.findFirst({ where: eq(vendors.id, item.vendorId) });
    if (!vendor) continue;
    const [cert] = await d
      .insert(certificates)
      .values({
        code: reference("WB-COA", 8),
        productId: item.productId,
        orderItemId: item.id,
        vendorId: vendor.id,
        artisanName: vendor.displayName,
        craft: vendor.craft,
        title: item.title,
        materials: item.product.materials,
        region: [vendor.workshopCity, "Pakistan"].filter(Boolean).join(", "),
        madeOn: new Date().toISOString().slice(0, 10),
      })
      .returning();
    await d.update(orderItems).set({ certificateId: cert.id }).where(eq(orderItems.id, item.id));
  }
}

// ── Disputes & refunds ──────────────────────────────────────────────────────

export async function openDispute(
  orderNumber: string,
  userId: string,
  input: { reason: "damaged" | "not_as_described" | "not_received" | "wrong_item" | "other"; description: string; desiredOutcome?: string; evidenceUrls: string[]; vendorOrderId?: string | null },
) {
  const d = await db();
  const order = await d.query.orders.findFirst({ where: eq(orders.number, orderNumber) });
  if (!order || order.userId !== userId) throw new OrderError("Order not found");
  if (order.paymentStatus !== "paid" || ["refunded", "cancelled"].includes(order.status)) throw new OrderError("Cases can be opened on paid orders only.");
  const open = await d.query.disputes.findFirst({ where: and(eq(disputes.orderId, order.id), sql`${disputes.status} not in ('resolved','closed')`) });
  if (open) throw new OrderError("There's already an open case for this order.");
  const number = reference("CASE");
  await d.transaction(async (tx) => {
    const [dispute] = await tx
      .insert(disputes)
      .values({ number, orderId: order.id, vendorOrderId: input.vendorOrderId ?? null, userId, reason: input.reason, description: input.description, desiredOutcome: input.desiredOutcome, evidenceUrls: input.evidenceUrls, status: "open" })
      .returning();
    await tx.insert(disputeMessages).values({ disputeId: dispute.id, authorUserId: userId, authorRole: "buyer", body: input.description });
    await tx.update(orders).set({ status: "disputed", fundsState: order.fundsState === "held" ? "frozen" : order.fundsState }).where(eq(orders.id, order.id));
    await event(tx, order.id, "dispute", `Case ${number} opened — held funds are frozen while we review it.`, { actorUserId: userId });
    await notifyVendors(tx, order.id, { kind: "dispute", title: `A buyer opened case ${number}`, link: "/seller/orders" });
  });
  return number;
}

export async function addDisputeMessage(disputeId: string, author: { userId: string; role: "buyer" | "seller" | "staff" }, body: string) {
  if (!body.trim()) throw new OrderError("Write a message first.");
  const d = await db();
  await d.insert(disputeMessages).values({ disputeId, authorUserId: author.userId, authorRole: author.role, body: body.trim() });
  const next = author.role === "buyer" ? "under_review" : author.role === "seller" ? "under_review" : undefined;
  if (next) await d.update(disputes).set({ status: next }).where(and(eq(disputes.id, disputeId), sql`${disputes.status} not in ('resolved','closed')`));
}

export async function refundOrder(orderId: string, amount: number, reason: string, actor: { userId: string; disputeId?: string | null }) {
  const d = await db();
  const order = await d.query.orders.findFirst({ where: eq(orders.id, orderId), with: { payments: true, refunds: true } });
  if (!order) throw new OrderError("Order not found");
  const refunded = order.refunds.filter((r) => r.status === "processed").reduce((a, r) => a + r.amount, 0);
  if (amount <= 0 || amount > order.total - refunded) throw new OrderError("Refund amount is more than what was paid.");
  const payment = order.payments.find((p) => p.status === "succeeded");
  if (payment) await refundPayment(payment, amount);
  const full = amount + refunded >= order.total;
  await d.transaction(async (tx) => {
    await tx.insert(refunds).values({ orderId, disputeId: actor.disputeId ?? null, amount, currency: order.currency, reason, status: "processed", createdById: actor.userId, processedAt: new Date() });
    await tx
      .update(orders)
      .set({ paymentStatus: full ? "refunded" : "partially_refunded", ...(full ? { status: "refunded", fundsState: "refunded" } : {}) })
      .where(eq(orders.id, orderId));
    await event(tx, orderId, "refund", `Refund of ${formatMoney(amount, order.currency as Currency)} issued (${reason}).`, { actorUserId: actor.userId });
  });
  await sendEmail({ to: order.email, subject: `Refund for ${order.number}`, template: "refund", body: `We've refunded ${formatMoney(amount, order.currency as Currency)} to your original payment method.` });
}

export async function resolveDispute(
  disputeId: string,
  actorUserId: string,
  r: { resolution: "refund" | "partial_refund" | "replacement" | "no_action"; refundAmount?: number; note: string },
) {
  const d = await db();
  const dispute = await d.query.disputes.findFirst({ where: eq(disputes.id, disputeId), with: { order: true } });
  if (!dispute) throw new OrderError("Case not found");
  const order = dispute.order;
  if (r.resolution === "refund") {
    const done = (await d.select().from(refunds).where(and(eq(refunds.orderId, order.id), eq(refunds.status, "processed")))).reduce((a, x) => a + x.amount, 0);
    await refundOrder(order.id, order.total - done, `Case ${dispute.number}`, { userId: actorUserId, disputeId });
  } else if (r.resolution === "partial_refund") {
    if (!r.refundAmount) throw new OrderError("Enter the partial refund amount.");
    await refundOrder(order.id, r.refundAmount, `Case ${dispute.number} (partial)`, { userId: actorUserId, disputeId });
    await d.update(orders).set({ status: "delivered", fundsState: "held" }).where(eq(orders.id, order.id));
    await releaseFunds(order.id, { userId: actorUserId, reason: `case ${dispute.number} resolved with a partial refund` });
  } else if (r.resolution === "replacement") {
    await d.update(orders).set({ status: "in_fulfilment", fundsState: "held" }).where(eq(orders.id, order.id));
    if (dispute.vendorOrderId) await d.update(vendorOrders).set({ status: "accepted" }).where(eq(vendorOrders.id, dispute.vendorOrderId));
    await event(d, order.id, "replacement", "A replacement is being made. Funds stay held until it arrives.", { actorUserId });
  } else {
    await d.update(orders).set({ status: "delivered", fundsState: "held" }).where(eq(orders.id, order.id));
    await releaseFunds(order.id, { userId: actorUserId, reason: `case ${dispute.number} closed without action` });
  }
  await d
    .update(disputes)
    .set({ status: "resolved", resolution: r.resolution, resolutionNote: r.note, resolvedAt: new Date() })
    .where(eq(disputes.id, disputeId));
  await d.insert(disputeMessages).values({ disputeId, authorUserId: actorUserId, authorRole: "staff", body: `Resolved: ${r.resolution.replace("_", " ")}. ${r.note}` });
  await notify(d, order.userId, { kind: "dispute", title: `Case ${dispute.number} resolved`, link: `/account/disputes/${dispute.number}` });
}

export async function cancelOrder(orderId: string, actor: { userId: string; reason: string; isStaff?: boolean }) {
  const d = await db();
  const order = await d.query.orders.findFirst({ where: eq(orders.id, orderId), with: { items: true, vendorOrders: true } });
  if (!order) throw new OrderError("Order not found");
  if (!actor.isStaff && order.userId !== actor.userId) throw new OrderError("Order not found");
  if (order.vendorOrders.some((v) => ["shipped", "delivered"].includes(v.status))) throw new OrderError("Shipped orders can't be cancelled — open a case instead.");
  if (["cancelled", "refunded", "completed"].includes(order.status)) throw new OrderError("This order is already closed.");
  if (order.paymentStatus === "paid") await refundOrder(orderId, order.total, `Cancelled: ${actor.reason}`, { userId: actor.userId });
  await d.transaction(async (tx) => {
    for (const it of order.items) {
      const p = it.productId ? await tx.query.products.findFirst({ where: eq(products.id, it.productId) }) : null;
      if (p?.availability === "ready_to_ship") await tx.update(products).set({ stockQty: sql`${products.stockQty} + ${it.qty}` }).where(eq(products.id, p.id));
    }
    await tx.update(orders).set({ status: "cancelled", cancelledAt: new Date(), fundsState: order.paymentStatus === "paid" ? "refunded" : "none" }).where(eq(orders.id, orderId));
    await tx.update(vendorOrders).set({ status: "cancelled" }).where(eq(vendorOrders.orderId, orderId));
    await event(tx, orderId, "cancelled", `Order cancelled (${actor.reason}).`, { actorUserId: actor.userId });
  });
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  awaiting_quote: "Confirming costs",
  quote_sent: "Quote ready — approve to pay",
  awaiting_payment: "Awaiting payment",
  paid: "Paid — funds held",
  in_fulfilment: "Being made / packed",
  shipped: "Shipped",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  disputed: "Case open",
};

export const ORDER_STATUS_TONE: Record<string, "neutral" | "indigo" | "terracotta" | "gold" | "success" | "warning" | "danger" | "pending" | "turquoise"> = {
  awaiting_quote: "pending",
  quote_sent: "gold",
  awaiting_payment: "warning",
  paid: "indigo",
  in_fulfilment: "indigo",
  shipped: "turquoise",
  delivered: "success",
  completed: "success",
  cancelled: "neutral",
  refunded: "neutral",
  disputed: "danger",
};
