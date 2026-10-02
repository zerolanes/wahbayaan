import "server-only";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { brandCartItems, brandCarts, brandFulfilments, brandOrderItems, brandProductVariants, couriers, notifications, orderEvents, orders, type OrderAddress } from "@/lib/db/schema";
import { getBuyerContext } from "@/lib/buyer-context";
import { OrderError } from "@/lib/commerce/orders";
import { sendEmail } from "@/lib/email";
import { reference } from "@/lib/ids";
import { convertFromPkr, convertToPkr, formatMoney, isDomestic, type Currency, type FxQuote } from "@/lib/money/currency";
import { testPaymentsAllowed } from "@/lib/payments";
import { methodAvailability, type Market, type PaymentMethodId } from "@/lib/payments/methods";
import { getSettings } from "@/lib/settings";
import type { BrandBag } from "./bag";
import { buildTrackingUrl } from "./domestic";
import { computeBrandQuote } from "./pricing";
import { getBrandPricingContext } from "./rates";
import type { ParsedRequestItem } from "./requests";
import { requestReadyToQuote } from "./requests";

/**
 * Pakistani Brands orders. They live in the shared `orders` table (kind
 * `brand`) so every existing order view, report, escrow and refund flow sees
 * them; items are `brand_order_items` and fulfilment is a per-brand checklist:
 * ordered from brand → received at Wahbayaan → quality checked → dispatched →
 * delivered. Wahbayaan buys from the brand on the buyer's behalf.
 */

export function marketFor(currency: string): Market {
  return currency === "PKR" ? "domestic" : "international";
}

async function assertMethod(method: PaymentMethodId, currency: string) {
  const { payment_methods } = await getSettings(["payment_methods"]);
  const a = methodAvailability(method, payment_methods[method], marketFor(currency), process.env, testPaymentsAllowed());
  if (!a.available) throw new OrderError(`${a.label} isn't available yet (${a.note}). Choose another payment method.`);
}

async function event(orderId: string, kind: string, message: string, opts: { actorUserId?: string | null; visibleToBuyer?: boolean } = {}) {
  const d = await db();
  await d.insert(orderEvents).values({ orderId, kind, message, actorUserId: opts.actorUserId ?? null, visibleToBuyer: opts.visibleToBuyer ?? true });
}

async function notify(userId: string | null, n: { kind: string; title: string; link?: string }) {
  if (!userId) return;
  const d = await db();
  await d.insert(notifications).values({ userId, ...n });
}

const lineOf = (lines: { key: string; status: string; amount: number | null }[], key: string) => lines.find((l) => l.key === key);
const statusOf = (lines: { key: string; status: string; amount: number | null }[], key: string) =>
  (lineOf(lines, key)?.status ?? "not_applicable") as "known" | "pending" | "not_applicable";

// ── Catalogue orders (from the brand bag) ───────────────────────────────────

export type PlaceBrandOrderInput = {
  bag: BrandBag;
  userId: string | null;
  email: string;
  customerName: string;
  address: OrderAddress;
  method: PaymentMethodId;
  buyerNotes?: string | null;
  giftMessage?: string | null;
};

export async function placeBrandOrder(input: PlaceBrandOrderInput) {
  const ctx = await getBuyerContext();
  if (!ctx.fx) throw new OrderError("Prices can't be shown in your currency yet. Please try again later.");
  const { bag } = input;
  if (!bag.cartId || !bag.lines.length) throw new OrderError("Your bag is empty.");
  const bad = bag.lines.filter((l) => l.unavailableReason);
  if (bad.length) throw new OrderError(`Please update these items first: ${bad.map((l) => `${l.title} (${l.unavailableReason})`).join(", ")}.`);
  if (input.address.country !== bag.shipTo) throw new OrderError(isDomestic(bag.shipTo) ? "The delivery address must be in Pakistan." : "The delivery address must be in the country you chose in your bag.");
  await assertMethod(input.method, ctx.currency);

  const rc = await getBrandPricingContext(bag.shipTo);
  const quote = computeBrandQuote({
    ...rc,
    items: bag.lines.map((l) => ({ key: l.variantId, title: l.title, unitPricePkr: l.unitPricePkr, qty: l.qty, weightG: l.weightG })),
    shipTo: bag.shipTo,
    city: input.address.city,
    fx: ctx.fx,
  });
  const d = await db();
  const number = reference("WB");
  const order = await d.transaction(async (tx) => {
    const [o] = await tx
      .insert(orders)
      .values({
        number,
        kind: "brand",
        brandFlow: "catalogue",
        userId: input.userId,
        email: input.email,
        customerName: input.customerName,
        currency: ctx.currency,
        fxPkrPerUnit: String(ctx.fx!.pkrPerUnit),
        fxSource: `${ctx.fx!.source} (${ctx.fx!.status})`,
        destinationCountry: bag.shipTo,
        shippingAddress: input.address,
        status: quote.complete ? "awaiting_payment" : "awaiting_quote",
        itemsSubtotal: quote.itemsSubtotal,
        shippingAmount: lineOf(quote.lines, "shipping")?.amount ?? null,
        shippingStatus: statusOf(quote.lines, "shipping"),
        dutyAmount: lineOf(quote.lines, "duty")?.amount ?? null,
        dutyStatus: statusOf(quote.lines, "duty"),
        importTaxAmount: lineOf(quote.lines, "import_tax")?.amount ?? null,
        importTaxStatus: statusOf(quote.lines, "import_tax"),
        handlingStatus: "not_applicable",
        serviceFeeAmount: lineOf(quote.lines, "service_fee")?.amount ?? null,
        serviceFeeStatus: statusOf(quote.lines, "service_fee"),
        paymentMethod: input.method,
        total: quote.knownTotal,
        totalComplete: quote.complete,
        isGift: bag.giftToPakistan,
        giftMessage: bag.giftToPakistan ? (input.giftMessage ?? bag.giftMessage) : null,
        buyerNotes: input.buyerNotes ?? null,
      })
      .returning();
    for (const l of bag.lines) {
      await tx.insert(brandOrderItems).values({
        orderId: o.id,
        brandId: l.brandId,
        productId: l.productId,
        variantId: l.variantId,
        brandName: l.brandName,
        title: l.title,
        size: l.size,
        colour: l.colour,
        sku: l.sku,
        sourceUrl: l.sourceUrl,
        imageUrl: l.imageUrl,
        qty: l.qty,
        weightG: l.weightG,
        unitPricePkr: l.unitPricePkr,
        unitPrice: l.unitPrice ?? convertFromPkr(l.unitPricePkr, ctx.fx!),
      });
      await tx
        .update(brandProductVariants)
        .set({ stockQty: sql`case when ${brandProductVariants.stockQty} is null then null else greatest(${brandProductVariants.stockQty} - ${l.qty}, 0) end` })
        .where(eq(brandProductVariants.id, l.variantId));
    }
    const brandsInOrder = [...new Map(bag.lines.map((l) => [l.brandName, l.brandId])).entries()];
    for (const [label, brandId] of brandsInOrder) await tx.insert(brandFulfilments).values({ orderId: o.id, brandId, brandLabel: label });
    await tx.delete(brandCartItems).where(eq(brandCartItems.cartId, bag.cartId!));
    await tx.update(brandCarts).set({ giftMessage: null }).where(eq(brandCarts.id, bag.cartId!));
    await tx.insert(orderEvents).values({ orderId: o.id, kind: "placed", message: "Order placed — Wahbayaan will buy these pieces from the brand on your behalf." });
    if (!quote.complete)
      await tx.insert(orderEvents).values({
        orderId: o.id,
        kind: "awaiting_quote",
        message: `Our team is confirming ${quote.pendingLines.map((l) => l.label.replace(/^Wahbayaan/, "the Wahbayaan").toLowerCase()).join(", ")}. You'll approve the final total before anything is charged.`,
      });
    return o;
  });
  await notify(input.userId, { kind: "order", title: `Order ${number} placed`, link: `/account/orders/${number}` });
  await sendEmail({
    to: input.email,
    subject: `Your Wahbayaan order ${number}`,
    template: "order_placed",
    body: order.totalComplete
      ? `Thank you, ${input.customerName}. Your order ${number} is reserved. Total: ${formatMoney(order.total, order.currency as Currency)}. Wahbayaan buys your pieces from the brand once you've paid.`
      : `Thank you, ${input.customerName}. Your order ${number} is reserved. We're confirming the remaining costs and will email you the final total to approve before anything is charged.`,
  });
  return order;
}

// ── Link requests ("shop any Pakistani brand by link") ──────────────────────

export type CreateRequestInput = {
  items: ParsedRequestItem[];
  shipTo: string;
  userId: string | null;
  email: string;
  customerName: string;
  address: OrderAddress;
  method: PaymentMethodId;
  buyerNotes?: string | null;
  giftMessage?: string | null;
};

export async function createLinkRequest(input: CreateRequestInput) {
  const ctx = await getBuyerContext();
  if (!ctx.fx) throw new OrderError("Prices can't be shown in your currency yet. Please try again later.");
  if (!input.items.length) throw new OrderError("Add at least one item.");
  if (input.address.country !== input.shipTo) throw new OrderError("The delivery address must be in the country you chose.");
  await assertMethod(input.method, ctx.currency);
  const gift = isDomestic(input.shipTo) && !isDomestic(ctx.destination);
  const d = await db();
  const number = reference("WB");
  const order = await d.transaction(async (tx) => {
    const [o] = await tx
      .insert(orders)
      .values({
        number,
        kind: "brand",
        brandFlow: "link_request",
        userId: input.userId,
        email: input.email,
        customerName: input.customerName,
        currency: ctx.currency,
        fxPkrPerUnit: String(ctx.fx!.pkrPerUnit),
        fxSource: `${ctx.fx!.source} (${ctx.fx!.status})`,
        destinationCountry: input.shipTo,
        shippingAddress: input.address,
        status: "awaiting_quote",
        itemsSubtotal: 0,
        shippingStatus: "pending",
        dutyStatus: isDomestic(input.shipTo) ? "not_applicable" : "pending",
        importTaxStatus: isDomestic(input.shipTo) ? "not_applicable" : "pending",
        handlingStatus: "not_applicable",
        serviceFeeStatus: "pending",
        paymentMethod: input.method,
        total: 0,
        totalComplete: false,
        isGift: gift,
        giftMessage: gift ? (input.giftMessage ?? null) : null,
        buyerNotes: input.buyerNotes ?? null,
      })
      .returning();
    for (const it of input.items)
      await tx.insert(brandOrderItems).values({
        orderId: o.id,
        brandName: it.brandName,
        title: it.productName,
        size: it.size,
        colour: it.colour,
        qty: it.qty,
        requestedUrl: it.url,
        requestedDomain: it.domain,
        buyerNote: it.notes,
      });
    for (const label of new Set(input.items.map((i) => i.brandName))) await tx.insert(brandFulfilments).values({ orderId: o.id, brandLabel: label });
    await tx.insert(orderEvents).values({
      orderId: o.id,
      kind: "request",
      message: `Request received for ${input.items.length} item${input.items.length === 1 ? "" : "s"}. Our team checks each item and its price at the brand, then sends you a quote to approve. Nothing is charged until you approve.`,
    });
    return o;
  });
  await notify(input.userId, { kind: "order", title: `Request ${number} received`, link: `/account/orders/${number}` });
  await sendEmail({
    to: input.email,
    subject: `We've received your brand request ${number}`,
    template: "brand_request",
    body: `Thank you, ${input.customerName}. We'll check ${input.items.length === 1 ? "the item" : `the ${input.items.length} items`} with the brand${input.items.length === 1 ? "" : "s"} and email you a quote to approve. Wahbayaan is a personal-shopping service buying on your behalf; we aren't affiliated with the brands.`,
  });
  return order;
}

// ── Staff quote (link-request prices and any pending lines) ────────────────

export type StaffItemPrice = { id: string; unitPricePkr: number | null; weightG: number | null; unavailable: boolean; staffNote: string | null };

export type BrandQuoteOverrides = {
  /** Amounts in the order's currency, used only for lines the engine still has pending. */
  shipping?: number | null;
  duty?: number | null;
  importTax?: number | null;
  serviceFee?: number | null;
  note?: string | null;
};

/** Save staff prices and recompute the quote. Returns the computed lines for preview. */
export async function priceBrandOrder(orderId: string, items: StaffItemPrice[]) {
  const d = await db();
  const order = await d.query.orders.findFirst({ where: eq(orders.id, orderId), with: { brandItems: true } });
  if (!order || order.kind !== "brand") throw new OrderError("Brand order not found");
  if (!["awaiting_quote", "quote_sent", "awaiting_payment"].includes(order.status)) throw new OrderError("This order can no longer be re-priced.");
  const fx: FxQuote = { currency: order.currency as Currency, pkrPerUnit: Number(order.fxPkrPerUnit), source: order.fxSource, status: "manual" };
  for (const p of items) {
    const it = order.brandItems.find((i) => i.id === p.id);
    if (!it) continue;
    await d
      .update(brandOrderItems)
      .set({
        unitPricePkr: p.unitPricePkr,
        unitPrice: p.unitPricePkr == null ? null : convertFromPkr(p.unitPricePkr, fx),
        weightG: p.weightG,
        unavailable: p.unavailable,
        staffNote: p.staffNote,
      })
      .where(eq(brandOrderItems.id, it.id));
  }
  return computeOrderQuote(orderId);
}

export async function computeOrderQuote(orderId: string) {
  const d = await db();
  const order = await d.query.orders.findFirst({ where: eq(orders.id, orderId), with: { brandItems: true } });
  if (!order || order.kind !== "brand") throw new OrderError("Brand order not found");
  const ready = requestReadyToQuote(order.brandItems);
  if (!ready.ok) return { ready, quote: null, order };
  const fx: FxQuote = { currency: order.currency as Currency, pkrPerUnit: Number(order.fxPkrPerUnit), source: order.fxSource, status: "manual" };
  const rc = await getBrandPricingContext(order.destinationCountry);
  const quote = computeBrandQuote({
    ...rc,
    items: order.brandItems.filter((i) => !i.unavailable).map((i) => ({ key: i.id, title: i.title, unitPricePkr: i.unitPricePkr!, qty: i.qty, weightG: i.weightG })),
    shipTo: order.destinationCountry,
    city: order.shippingAddress.city,
    fx,
  });
  return { ready, quote, order };
}

/** Send the final total to the buyer. Pending lines must be filled by staff first — nothing is sent as zero by default. */
export async function sendBrandQuote(orderId: string, o: BrandQuoteOverrides, actorUserId: string) {
  const { ready, quote, order } = await computeOrderQuote(orderId);
  if (!ready.ok || !quote) throw new OrderError(ready.ok ? "Nothing to quote." : ready.reason);
  const pick = (key: string, override: number | null | undefined, label: string) => {
    const l = lineOf(quote.lines, key);
    if (!l || l.status === "not_applicable") return { amount: null as number | null, status: "not_applicable" as const };
    if (l.status === "known") return { amount: l.amount, status: "known" as const };
    if (override == null) throw new OrderError(`${label} is still pending — enter the confirmed amount (in ${order.currency}) or set the rate in the admin first.`);
    return { amount: override, status: "known" as const };
  };
  const shipping = pick("shipping", o.shipping, "Shipping");
  const duty = pick("duty", o.duty, "Import duty");
  const tax = pick("import_tax", o.importTax, "Import tax");
  const fee = pick("service_fee", o.serviceFee, "The Wahbayaan service fee");
  const total = quote.itemsSubtotal + (shipping.amount ?? 0) + (duty.amount ?? 0) + (tax.amount ?? 0) + (fee.amount ?? 0) - order.discountAmount;
  const d = await db();
  await d
    .update(orders)
    .set({
      itemsSubtotal: quote.itemsSubtotal,
      shippingAmount: shipping.amount,
      shippingStatus: shipping.status,
      dutyAmount: duty.amount,
      dutyStatus: duty.status,
      importTaxAmount: tax.amount,
      importTaxStatus: tax.status,
      serviceFeeAmount: fee.amount,
      serviceFeeStatus: fee.status,
      total,
      totalComplete: true,
      status: "quote_sent",
      quoteNote: o.note ?? null,
      quoteSentAt: new Date(),
    })
    .where(eq(orders.id, orderId));
  const unavailable = order.brandItems.filter((i) => i.unavailable);
  await event(orderId, "quote", `Quote ready: ${formatMoney(total, order.currency as Currency)}${unavailable.length ? ` (${unavailable.length} item${unavailable.length === 1 ? "" : "s"} not available)` : ""}. Approve and pay to start your order.`, { actorUserId });
  await notify(order.userId, { kind: "quote", title: `Your quote for ${order.number} is ready`, link: `/account/orders/${order.number}` });
  await sendEmail({
    to: order.email,
    subject: `Your quote for ${order.number}`,
    template: "brand_quote",
    body: [
      `We've checked your items with the brand${unavailable.length ? "s" : ""}. Total: ${formatMoney(total, order.currency as Currency)} (items, delivery and the Wahbayaan service fee, itemised on your order page).`,
      unavailable.length ? `Not available: ${unavailable.map((i) => i.title).join(", ")}.` : "",
      o.note ? `Note from our team: ${o.note}` : "",
      `Approve and pay from your order page. Wahbayaan is a personal-shopping service buying on your behalf; we aren't affiliated with the brands.`,
    ]
      .filter(Boolean)
      .join("\n\n"),
  });
  return total;
}

// ── Fulfilment checklist ────────────────────────────────────────────────────

export type FulfilmentStep =
  | { step: "ordered_from_brand"; brandOrderRef?: string | null; purchaseCostPkr?: number | null }
  | { step: "received_at_wahbayaan" }
  | { step: "quality_checked"; notes?: string | null }
  | { step: "dispatched"; courier: string; trackingNumber: string }
  | { step: "delivered" };

const STEP_ORDER = ["pending", "ordered_from_brand", "received_at_wahbayaan", "quality_checked", "dispatched", "delivered"] as const;

const STEP_MESSAGE: Record<FulfilmentStep["step"], string> = {
  ordered_from_brand: "Bought from the brand on your behalf",
  received_at_wahbayaan: "Received at Wahbayaan",
  quality_checked: "Quality checked and packed",
  dispatched: "Dispatched",
  delivered: "Delivered",
};

/** Advance one brand's checklist (`fulfilmentId`) or every brand in the order (`"all"`). */
export async function advanceBrandFulfilment(orderId: string, fulfilmentId: string | "all", s: FulfilmentStep, actorUserId: string) {
  const d = await db();
  const order = await d.query.orders.findFirst({ where: eq(orders.id, orderId), with: { brandFulfilments: true } });
  if (!order || order.kind !== "brand") throw new OrderError("Brand order not found");
  if (order.paymentStatus !== "paid") throw new OrderError("Wahbayaan buys from the brand only after the buyer has paid.");
  if (["cancelled", "refunded", "completed"].includes(order.status)) throw new OrderError("This order is closed.");
  const targets = fulfilmentId === "all" ? order.brandFulfilments : order.brandFulfilments.filter((f) => f.id === fulfilmentId);
  if (!targets.length) throw new OrderError("Nothing to update.");
  const next = STEP_ORDER.indexOf(s.step);
  for (const f of targets) {
    if (STEP_ORDER.indexOf(f.status as (typeof STEP_ORDER)[number]) >= next) continue;
    if (STEP_ORDER.indexOf(f.status as (typeof STEP_ORDER)[number]) < next - 1)
      throw new OrderError(`${f.brandLabel}: complete “${STEP_MESSAGE[STEP_ORDER[next - 1] as FulfilmentStep["step"]] ?? "the previous step"}” first.`);
  }

  let trackingUrl: string | null = null;
  if (s.step === "dispatched") {
    if (!s.courier.trim() || !s.trackingNumber.trim()) throw new OrderError("Courier and tracking number are required.");
    const c = await d.query.couriers.findFirst({ where: eq(couriers.name, s.courier.trim()) });
    trackingUrl = buildTrackingUrl(c?.trackingUrlTemplate, s.trackingNumber);
  }
  const now = new Date();
  const patch: Partial<typeof brandFulfilments.$inferInsert> = { status: s.step };
  if (s.step === "ordered_from_brand") Object.assign(patch, { orderedAt: now, brandOrderRef: s.brandOrderRef ?? null, purchaseCostPkr: s.purchaseCostPkr ?? null });
  if (s.step === "received_at_wahbayaan") patch.receivedAt = now;
  if (s.step === "quality_checked") Object.assign(patch, { qualityCheckedAt: now, notes: s.notes ?? null });
  if (s.step === "dispatched") Object.assign(patch, { dispatchedAt: now, courier: s.courier.trim(), trackingNumber: s.trackingNumber.trim() });
  if (s.step === "delivered") patch.deliveredAt = now;

  const ids = targets.filter((f) => STEP_ORDER.indexOf(f.status as (typeof STEP_ORDER)[number]) < next).map((f) => f.id);
  if (!ids.length) return;
  const { escrow } = await getSettings(["escrow"]);
  await d.update(brandFulfilments).set(patch).where(inArray(brandFulfilments.id, ids));
  const all = await d.select().from(brandFulfilments).where(eq(brandFulfilments.orderId, orderId));
  const statuses = all.map((f) => f.status).filter((x) => x !== "cancelled");
  let status = order.status;
  if (statuses.every((x) => x === "delivered")) status = "delivered";
  else if (statuses.every((x) => x === "dispatched" || x === "delivered")) status = "shipped";
  else if (order.status === "paid") status = "in_fulfilment";
  if (status !== order.status && order.status !== "disputed")
    await d
      .update(orders)
      .set({ status, ...(status === "delivered" ? { deliveredAt: now, autoReleaseAt: new Date(now.getTime() + escrow.autoReleaseDaysAfterDelivery * 86_400_000) } : {}) })
      .where(eq(orders.id, orderId));

  const which = fulfilmentId === "all" || order.brandFulfilments.length === 1 ? "" : ` (${targets.map((t) => t.brandLabel).join(", ")})`;
  const message =
    s.step === "dispatched"
      ? `Dispatched with ${s.courier.trim()} — tracking ${s.trackingNumber.trim()}${trackingUrl ? ` · ${trackingUrl}` : ""}`
      : `${STEP_MESSAGE[s.step]}${which}`;
  await event(orderId, `brand_${s.step}`, message, { actorUserId });
  if (s.step === "ordered_from_brand" && s.purchaseCostPkr != null)
    await event(orderId, "brand_purchase_cost", `Purchase cost recorded: ${formatMoney(s.purchaseCostPkr, "PKR")}`, { actorUserId, visibleToBuyer: false });
  await notify(order.userId, { kind: "order", title: `${order.number}: ${message}`, link: `/account/orders/${order.number}` });
  if (s.step === "dispatched" || s.step === "delivered" || s.step === "ordered_from_brand")
    await sendEmail({ to: order.email, subject: `${order.number}: ${STEP_MESSAGE[s.step]}`, template: `brand_${s.step}`, body: `${message}.\n\nTrack your order from your account page.` });
}

/** PKR value of an order-currency amount (admin margin preview). */
export function toPkr(amount: number, order: { currency: string; fxPkrPerUnit: string }) {
  return convertToPkr(amount, { currency: order.currency as Currency, pkrPerUnit: Number(order.fxPkrPerUnit), source: "order", status: "manual" });
}
