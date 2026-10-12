import "server-only";
import { and, asc, desc, eq, inArray, notInArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  brandFulfilments,
  couriers,
  fulfilmentQuotes,
  hubParcels,
  hubs,
  notifications,
  orderEvents,
  orderFulfilments,
  orders,
  payments,
  returnRequests,
  shipmentItems,
  shipments,
  shippingRates,
  users,
  vendorOrders,
  vendors,
  type ReturnItem,
  type ShipmentDocItem,
} from "@/lib/db/schema";
import { OrderError, refundOrder, vendorOrderAction } from "@/lib/commerce/orders";
import { getFxTable } from "@/lib/commerce/rates";
import { sendEmail } from "@/lib/email";
import { reference } from "@/lib/ids";
import { convert, convertFromPkr, formatMoney, type Currency, type FxQuote } from "@/lib/money/currency";
import { startCheckout } from "@/lib/payments";
import { getSettings } from "@/lib/settings";
import { formatDate } from "@/lib/utils/format";
import {
  addDays,
  chargeableWeightG,
  consolidationProgress,
  estimateHubDispatch,
  partialShipmentCheck,
  slowestItemDays,
  volumetricWeightG,
  type HubParcelStatus,
  type TimedItem,
} from "./consolidation";
import { requireAdapter, CourierAdapterError } from "./couriers/registry";
import type { BookingRequest, BookingResult, Party } from "./couriers/types";
import { parcelReference, parseReference, shipmentReference } from "./reference";
import { routeOrder } from "./settings";

/**
 * Fulfilment service: routing, seller hand-over, hub operations, outbound
 * shipments, extra-shipping approvals and returns.
 *
 * Escrow and payouts are untouched: artisan sub-orders still move through
 * `vendorOrderAction` (accept → ready → shipped → delivered), which derives the
 * order status, starts the protection window and — after the buyer confirms —
 * releases funds to the artisans exactly as before.
 */

export { OrderError as FulfilmentError };

const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";
type Actor = { userId: string; vendorId?: string | null; isStaff?: boolean };

async function event(orderId: string, kind: string, message: string, opts: { actorUserId?: string | null; vendorOrderId?: string | null; visibleToBuyer?: boolean } = {}) {
  const d = await db();
  await d.insert(orderEvents).values({ orderId, kind, message, actorUserId: opts.actorUserId ?? null, vendorOrderId: opts.vendorOrderId ?? null, visibleToBuyer: opts.visibleToBuyer ?? true });
}

async function notify(userId: string | null | undefined, n: { kind: string; title: string; link?: string }) {
  if (!userId) return;
  const d = await db();
  await d.insert(notifications).values({ userId, ...n });
}

// ── Hubs ────────────────────────────────────────────────────────────────────

export type Hub = typeof hubs.$inferSelect;

/** The origin hub that consolidates exports: a real active hub first, else an active demo hub. */
export async function getActiveOriginHub(): Promise<Hub | null> {
  const d = await db();
  const [hub] = await d
    .select()
    .from(hubs)
    .where(and(eq(hubs.type, "origin"), eq(hubs.isActive, true)))
    .orderBy(asc(hubs.isDemo), asc(hubs.createdAt))
    .limit(1);
  return hub ?? null;
}

export function hubParty(hub: Hub): Party {
  return {
    name: `Wahbayaan — ${hub.name}`,
    line1: hub.address.line1,
    line2: hub.address.line2 ?? null,
    city: hub.address.city || hub.city,
    region: hub.address.region ?? null,
    postalCode: hub.address.postalCode ?? null,
    country: hub.address.country || hub.country,
    phone: hub.contactPhone,
  };
}

/** True while the hub address still holds `[Add: …]` placeholders. */
export function hubAddressIsPlaceholder(hub: Pick<Hub, "address">) {
  return Object.values(hub.address).some((v) => typeof v === "string" && /\[Add:/i.test(v));
}

function buyerParty(order: typeof orders.$inferSelect): Party {
  const a = order.shippingAddress;
  return { name: a.fullName, line1: a.line1, line2: a.line2 ?? null, city: a.city, region: a.region ?? null, postalCode: a.postalCode ?? null, country: a.country, phone: a.phone ?? null };
}

function sellerParty(v: { displayName: string; workshopCity: string | null }, phone?: string | null): Party {
  return { name: v.displayName, line1: `${v.displayName} workshop`, city: v.workshopCity ?? "Pakistan", country: "PK", phone: phone ?? null };
}

/** Stable 1-based parcel number for an artisan sub-order within its order. */
function parcelIndex(all: { id: string }[], id: string) {
  return [...all].sort((a, b) => a.id.localeCompare(b.id)).findIndex((v) => v.id === id) + 1;
}

// ── Routing (on payment) ────────────────────────────────────────────────────

/**
 * Called once the order is paid (idempotent). Domestic orders ship direct from
 * each seller; international orders consolidate at the active origin hub
 * (Pakistani Brands orders too — Wahbayaan already receives those itself).
 * Without an active hub everything ships direct, as before.
 */
export async function ensureFulfilment(orderId: string) {
  const d = await db();
  const existing = await d.query.orderFulfilments.findFirst({ where: eq(orderFulfilments.orderId, orderId) });
  if (existing) return existing;
  const order = await d.query.orders.findFirst({
    where: eq(orders.id, orderId),
    with: { vendorOrders: { with: { vendor: true, items: { with: { product: true } } } }, brandFulfilments: true, brandItems: true },
  });
  if (!order) return null;
  const s = await getSettings(["fulfilment", "domestic_delivery"]);
  const hub = await getActiveOriginHub();
  const routed = order.kind === "brand" ? (hub ? { mode: "hub" as const, hubId: hub.id } : { mode: "direct" as const, hubId: null }) : routeOrder({ destination: order.destinationCountry, setting: s.fulfilment, activeOriginHubId: hub?.id ?? null });
  const start = order.paidAt ?? new Date();
  const brandTimed: TimedItem = { availability: "ready_to_ship", timeToMakeDays: null, dispatchDays: s.domestic_delivery.handlingDays };
  const timedFor = (vo: (typeof order.vendorOrders)[number]): TimedItem[] =>
    vo.items.map((i) => ({ availability: i.product?.availability ?? "ready_to_ship", timeToMakeDays: i.product?.timeToMakeDays ?? null, dispatchDays: i.product?.dispatchDays ?? null }));
  const allTimed = order.kind === "brand" ? order.brandItems.map(() => brandTimed) : order.vendorOrders.flatMap(timedFor);
  let estimatedDispatchAt: Date | null = null;
  if (routed.mode === "hub" && hub) {
    const est = estimateHubDispatch(start, allTimed, hub.handlingDays);
    estimatedDispatchAt = est.status === "known" ? est.dispatchAt : null;
  } else {
    const slowest = slowestItemDays(allTimed);
    estimatedDispatchAt = slowest == null ? null : addDays(start, slowest);
  }
  const [row] = await d.insert(orderFulfilments).values({ orderId, mode: routed.mode, hubId: routed.hubId, estimatedDispatchAt }).onConflictDoNothing().returning();
  if (!row) return d.query.orderFulfilments.findFirst({ where: eq(orderFulfilments.orderId, orderId) });

  if (routed.mode === "hub" && hub) {
    if (order.kind === "brand") {
      const live = order.brandFulfilments.filter((f) => f.status !== "cancelled").sort((a, b) => a.id.localeCompare(b.id));
      for (const [i, f] of live.entries())
        await d.insert(hubParcels).values({
          reference: parcelReference(order.number, i + 1),
          hubId: hub.id,
          orderId,
          brandFulfilmentId: f.id,
          senderLabel: f.brandLabel,
          expectedBy: s.domestic_delivery.handlingDays == null ? null : addDays(start, s.domestic_delivery.handlingDays),
        });
    } else {
      for (const vo of order.vendorOrders.filter((v) => v.status !== "cancelled")) {
        const days = slowestItemDays(timedFor(vo));
        await d.insert(hubParcels).values({
          reference: parcelReference(order.number, parcelIndex(order.vendorOrders, vo.id)),
          hubId: hub.id,
          orderId,
          vendorOrderId: vo.id,
          senderLabel: vo.vendor.displayName,
          senderCity: vo.vendor.workshopCity,
          expectedBy: days == null ? null : addDays(start, days),
        });
      }
    }
    await event(orderId, "fulfilment_hub", `Your pieces will be checked and packed together at our hub in ${hub.city}, then shipped to you in one box.${estimatedDispatchAt ? ` Estimated dispatch: ${formatDate(estimatedDispatchAt)}.` : ""}`);
  } else if (order.kind !== "brand" && order.vendorOrders.length > 1) {
    await event(orderId, "fulfilment_direct", `Your order arrives in ${order.vendorOrders.length} parcels — each seller ships theirs straight to you.`);
  }
  return row;
}

// ── Courier booking ─────────────────────────────────────────────────────────

/** The courier row and its booking adapter (Admin → Hubs → Courier booking; manual unless set). */
export async function courierWithAdapter(name: string) {
  const d = await db();
  const courier = (await d.query.couriers.findFirst({ where: eq(couriers.name, name.trim()) })) ?? null;
  const { fulfilment } = await getSettings(["fulfilment"]);
  const adapterId = (courier && fulfilment.courierAdapters[courier.id]) || "manual";
  return { courier, adapterId };
}

async function book(courierName: string, useAdapter: boolean, req: Omit<BookingRequest, "courierName" | "trackingUrlTemplate">): Promise<BookingResult & { courierId: string | null }> {
  const { courier, adapterId } = await courierWithAdapter(courierName);
  const id = useAdapter ? adapterId : "manual";
  if (useAdapter && id === "manual") throw new OrderError(`${courierName} is booked manually — book with the courier and enter the tracking number.`);
  try {
    const adapter = requireAdapter(id);
    const res = await adapter.bookShipment({ ...req, courierName: courier?.name ?? courierName.trim(), trackingUrlTemplate: courier?.trackingUrlTemplate ?? null });
    return { ...res, courierId: courier?.id ?? null };
  } catch (e) {
    if (e instanceof CourierAdapterError) throw new OrderError(e.message);
    throw e;
  }
}

// ── Seller: domestic direct parcels ─────────────────────────────────────────

async function loadVendorOrder(vendorOrderId: string, actor: Actor) {
  const d = await db();
  const vo = await d.query.vendorOrders.findFirst({ where: eq(vendorOrders.id, vendorOrderId), with: { order: { with: { vendorOrders: true } }, vendor: true, items: { with: { product: true } } } });
  if (!vo) throw new OrderError("Order not found");
  if (!actor.isStaff && vo.vendorId !== actor.vendorId) throw new OrderError("Not your order");
  if (!["paid", "in_fulfilment", "shipped", "delivered"].includes(vo.order.status)) throw new OrderError("This order isn't paid yet or is closed.");
  return vo;
}

const parcelWeight = (items: { qty: number; product: { weightG: number | null } | null }[]) =>
  items.every((i) => i.product?.weightG) ? items.reduce((a, i) => a + i.product!.weightG! * i.qty, 0) : null;

async function markReadyQuietly(vo: { id: string; status: string }, actor: Actor) {
  if (["pending", "accepted", "in_production"].includes(vo.status)) await vendorOrderAction(vo.id, { type: "ready" }, { ...actor, isStaff: true }, { quiet: true });
}

/** "Book courier" for a parcel going straight to the buyer. Hand-over (which notifies the buyer) is a separate step. */
export async function bookDirectParcel(vendorOrderId: string, actor: Actor, input: { courierName: string; serviceName?: string | null; useAdapter: boolean; trackingNumber?: string | null }) {
  const vo = await loadVendorOrder(vendorOrderId, actor);
  if (["shipped", "delivered", "cancelled"].includes(vo.status)) throw new OrderError("This parcel has already left.");
  if (!input.courierName.trim()) throw new OrderError("Choose a courier.");
  const d = await db();
  const f = await d.query.orderFulfilments.findFirst({ where: eq(orderFulfilments.orderId, vo.orderId) });
  if (f?.mode === "hub") throw new OrderError("This order is consolidated at our hub — use “Send to hub”.");
  const ref = parcelReference(vo.order.number, parcelIndex(vo.order.vendorOrders, vo.id));
  const sellerUser = await d.query.users.findFirst({ where: eq(users.id, vo.vendor.userId), columns: { phone: true } });
  const weightG = parcelWeight(vo.items);
  const booking = await book(input.courierName, input.useAdapter, {
    reference: ref,
    serviceName: input.serviceName ?? null,
    from: sellerParty(vo.vendor, sellerUser?.phone),
    to: buyerParty(vo.order),
    weightG,
    trackingNumber: input.trackingNumber ?? null,
    contents: vo.items.map((i) => `${i.qty} × ${i.title}`).join(", "),
  });
  // Re-booking replaces an earlier booking that never left.
  await d.update(shipments).set({ status: "cancelled" }).where(and(eq(shipments.vendorOrderId, vo.id), eq(shipments.status, "booked")));
  await d.delete(shipments).where(and(eq(shipments.reference, ref), eq(shipments.status, "cancelled")));
  const [row] = await d
    .insert(shipments)
    .values({
      reference: ref,
      orderId: vo.orderId,
      kind: "direct",
      status: "booked",
      vendorOrderId: vo.id,
      courierId: booking.courierId,
      courierName: input.courierName.trim(),
      serviceName: input.serviceName ?? null,
      provider: booking.provider,
      bookingRef: booking.bookingRef,
      trackingNumber: booking.trackingNumber,
      trackingUrl: booking.trackingUrl,
      weightG,
      documentItems: vo.items.map((i) => ({ title: i.title, qty: i.qty, hsCode: i.hsCode, unitValue: i.unitPrice, weightG: i.product?.weightG ?? null, origin: "PK", sender: vo.vendor.displayName })),
      createdById: actor.userId,
      bookedAt: new Date(),
    })
    .returning();
  await d.insert(shipmentItems).values(vo.items.map((i) => ({ shipmentId: row.id, orderItemId: i.id, qty: i.qty })));
  await markReadyQuietly(vo, actor);
  await event(vo.orderId, "parcel_booked", `${vo.vendor.displayName}: courier booked with ${row.courierName} (${row.trackingNumber})`, { actorUserId: actor.userId, vendorOrderId: vo.id, visibleToBuyer: false });
  return row;
}

/** The seller handed the booked parcel to the courier: the buyer gets the tracking number (one email per parcel). */
export async function handOverDirectParcel(shipmentId: string, actor: Actor) {
  const d = await db();
  const sh = await d.query.shipments.findFirst({ where: eq(shipments.id, shipmentId) });
  if (!sh || sh.kind !== "direct" || !sh.vendorOrderId) throw new OrderError("Parcel not found");
  if (sh.status !== "booked") throw new OrderError("This parcel isn't waiting for hand-over.");
  const vo = await loadVendorOrder(sh.vendorOrderId, actor);
  await vendorOrderAction(vo.id, { type: "ship", courier: sh.courierName ?? "Courier", trackingNumber: sh.trackingNumber ?? sh.reference, trackingUrl: sh.trackingUrl, packageWeightG: sh.weightG }, actor);
  await d.update(shipments).set({ status: "shipped", shippedAt: new Date() }).where(eq(shipments.id, sh.id));
}

// ── Seller: send to hub ─────────────────────────────────────────────────────

export async function getParcelForVendorOrder(vendorOrderId: string) {
  const d = await db();
  return (await d.query.hubParcels.findFirst({ where: eq(hubParcels.vendorOrderId, vendorOrderId), with: { hub: true } })) ?? null;
}

/** The seller sends their parcel to the hub: booked through Wahbayaan's courier, booked by themselves, or dropped off in person. */
export async function sendParcelToHub(vendorOrderId: string, actor: Actor, input: { method: "book" | "manual" | "drop_off"; courierName?: string | null; trackingNumber?: string | null }) {
  const vo = await loadVendorOrder(vendorOrderId, actor);
  const d = await db();
  const parcel = await d.query.hubParcels.findFirst({ where: eq(hubParcels.vendorOrderId, vo.id), with: { hub: true } });
  if (!parcel) throw new OrderError("This order isn't routed through a hub.");
  if (!["expected", "in_transit"].includes(parcel.status)) throw new OrderError("The hub has already received this parcel.");
  let courier: string | null = null;
  let tracking: string | null = null;
  let trackingUrl: string | null = null;
  let provider = "drop_off";
  if (input.method === "drop_off") {
    courier = "Drop-off at hub";
  } else {
    if (!input.courierName?.trim()) throw new OrderError("Choose a courier.");
    const sellerUser = await d.query.users.findFirst({ where: eq(users.id, vo.vendor.userId), columns: { phone: true } });
    const booking = await book(input.courierName, input.method === "book", {
      reference: parcel.reference,
      from: sellerParty(vo.vendor, sellerUser?.phone),
      to: hubParty(parcel.hub),
      weightG: parcelWeight(vo.items),
      trackingNumber: input.trackingNumber ?? null,
      contents: vo.items.map((i) => `${i.qty} × ${i.title}`).join(", "),
    });
    courier = input.courierName.trim();
    tracking = booking.trackingNumber;
    trackingUrl = booking.trackingUrl;
    provider = booking.provider;
  }
  await d.update(hubParcels).set({ status: "in_transit", courier, trackingNumber: tracking, trackingUrl, provider, sentAt: new Date() }).where(eq(hubParcels.id, parcel.id));
  await markReadyQuietly(vo, actor);
  await event(vo.orderId, "parcel_to_hub", `${vo.vendor.displayName} sent their piece to our hub`, { actorUserId: actor.userId, vendorOrderId: vo.id });
  return { ...parcel, courier, trackingNumber: tracking };
}

// ── Hub: inbound, QC, storage ───────────────────────────────────────────────

export type ParcelRow = typeof hubParcels.$inferSelect;

/** A typed or scanned reference (check character verified) or a courier tracking number. */
export async function findParcel(input: string) {
  const d = await db();
  const raw = input.trim().toUpperCase().replace(/\s+/g, "");
  if (!raw) return null;
  const parsed = parseReference(raw);
  if (parsed) return (await d.query.hubParcels.findFirst({ where: eq(hubParcels.reference, parsed.reference) })) ?? null;
  return (await d.query.hubParcels.findFirst({ where: eq(hubParcels.trackingNumber, raw) })) ?? null;
}

async function itemCounts(orderId: string) {
  const d = await db();
  const order = await d.query.orders.findFirst({ where: eq(orders.id, orderId), with: { items: true, brandItems: true } });
  const count = new Map<string, number>();
  for (const i of order?.items ?? []) count.set(i.vendorOrderId, (count.get(i.vendorOrderId) ?? 0) + i.qty);
  const brand = new Map<string, number>();
  for (const i of order?.brandItems ?? []) if (!i.unavailable) brand.set(i.brandName, (brand.get(i.brandName) ?? 0) + i.qty);
  return { count, brand };
}

/** Parcels of an order with item counts, for consolidation maths. */
export async function orderParcels(orderId: string) {
  const d = await db();
  const rows = await d.query.hubParcels.findMany({ where: eq(hubParcels.orderId, orderId), with: { brandFulfilment: true }, orderBy: asc(hubParcels.reference) });
  const { count, brand } = await itemCounts(orderId);
  return rows.map((p) => ({ ...p, itemCount: p.vendorOrderId ? (count.get(p.vendorOrderId) ?? 1) : (brand.get(p.brandFulfilment?.brandLabel ?? p.senderLabel) ?? 1) }));
}

async function setBrandStep(fulfilmentId: string, step: "received_at_wahbayaan" | "quality_checked") {
  const d = await db();
  const f = await d.query.brandFulfilments.findFirst({ where: eq(brandFulfilments.id, fulfilmentId) });
  if (!f) return;
  const rank = ["pending", "ordered_from_brand", "received_at_wahbayaan", "quality_checked", "dispatched", "delivered"];
  if (rank.indexOf(f.status) >= rank.indexOf(step)) return;
  await d
    .update(brandFulfilments)
    .set({ status: step, ...(step === "received_at_wahbayaan" ? { receivedAt: new Date() } : { qualityCheckedAt: new Date() }) })
    .where(eq(brandFulfilments.id, fulfilmentId));
  await d.update(orders).set({ status: "in_fulfilment" }).where(and(eq(orders.id, f.orderId), eq(orders.status, "paid")));
}

export async function receiveParcel(parcelId: string, actor: Actor, input: { weightG?: number | null } = {}) {
  const d = await db();
  const p = await d.query.hubParcels.findFirst({ where: eq(hubParcels.id, parcelId), with: { vendorOrder: true } });
  if (!p) throw new OrderError("Parcel not found");
  if (!["expected", "in_transit"].includes(p.status)) throw new OrderError(`${p.reference} is already ${p.status.replace("_", " ")}.`);
  await d.update(hubParcels).set({ status: "received", receivedAt: new Date(), receivedById: actor.userId, measuredWeightG: input.weightG ?? null }).where(eq(hubParcels.id, p.id));
  if (p.vendorOrder) await markReadyQuietly(p.vendorOrder, actor);
  if (p.brandFulfilmentId) await setBrandStep(p.brandFulfilmentId, "received_at_wahbayaan");
  const progress = consolidationProgress(await orderParcels(p.orderId));
  await event(p.orderId, "hub_received", `A piece from ${p.senderLabel} arrived at our hub (${progress.label})`, { actorUserId: actor.userId, vendorOrderId: p.vendorOrderId });
  return { parcel: p, progress };
}

export async function qcParcel(parcelId: string, actor: Actor, input: { result: "pass" | "fail"; notes?: string | null; photos?: string[]; bin?: string | null }) {
  const d = await db();
  const p = await d.query.hubParcels.findFirst({ where: eq(hubParcels.id, parcelId), with: { order: true, vendorOrder: { with: { vendor: true } } } });
  if (!p) throw new OrderError("Parcel not found");
  if (!["received", "qc_failed", "qc_passed"].includes(p.status)) throw new OrderError("Receive the parcel before checking it.");
  if (input.result === "fail" && !input.notes?.trim()) throw new OrderError("Describe the problem so the seller can put it right.");
  const photos = [...p.qcPhotos, ...(input.photos ?? [])].slice(0, 12);
  await d
    .update(hubParcels)
    .set({ status: input.result === "pass" ? "qc_passed" : "qc_failed", qcNotes: input.notes ?? p.qcNotes, qcPhotos: photos, qcAt: new Date(), qcById: actor.userId, bin: input.bin ?? p.bin })
    .where(eq(hubParcels.id, p.id));
  if (input.result === "pass") {
    if (p.brandFulfilmentId) await setBrandStep(p.brandFulfilmentId, "quality_checked");
    const progress = consolidationProgress(await orderParcels(p.orderId));
    await event(p.orderId, "hub_qc_passed", `${p.senderLabel}: checked at our hub`, { actorUserId: actor.userId, vendorOrderId: p.vendorOrderId });
    if (progress.readyToPack && progress.shippedItems === 0) {
      await event(p.orderId, "hub_all_arrived", "Everything has arrived at our hub and been checked — we're packing your box.");
      await sendEmail({
        to: p.order.email,
        subject: `${p.order.number}: everything has arrived at our hub`,
        template: "hub_all_arrived",
        body: `All ${progress.totalItems} item${progress.totalItems === 1 ? "" : "s"} of your order ${p.order.number} have arrived at our hub and been checked. We're packing them into one box now — you'll get the tracking number as soon as it leaves.\n\n${appUrl()}/account/orders/${p.order.number}`,
      });
    }
    return progress;
  }
  await event(p.orderId, "hub_qc_failed", `QC failed for ${p.reference} (${p.senderLabel}): ${input.notes}`, { actorUserId: actor.userId, vendorOrderId: p.vendorOrderId, visibleToBuyer: false });
  if (p.vendorOrder) {
    const u = await d.query.users.findFirst({ where: eq(users.id, p.vendorOrder.vendor.userId), columns: { email: true, id: true } });
    if (u) {
      await notify(u.id, { kind: "order", title: `${p.order.number}: our hub found a problem with your parcel`, link: `/seller/orders/${p.vendorOrder.id}` });
      await sendEmail({
        to: u.email,
        subject: `Order ${p.order.number}: please contact us about your parcel`,
        template: "vendor_qc_failed",
        body: `Salaam ${p.vendorOrder.vendor.displayName},\n\nOur hub checked your parcel ${p.reference} and found a problem:\n\n${input.notes}\n\nOur team will contact you to agree how to put it right (repair, replacement or return).\n\n${appUrl()}/seller/orders/${p.vendorOrder.id}`,
      });
    }
  }
  return consolidationProgress(await orderParcels(p.orderId));
}

export async function setParcelBin(parcelId: string, bin: string | null) {
  const d = await db();
  await d.update(hubParcels).set({ bin: bin?.trim() || null }).where(eq(hubParcels.id, parcelId));
}

/** A failed parcel goes back to the seller to be put right; the hub expects it again. */
export async function sendParcelBackToSeller(parcelId: string, actor: Actor, note: string) {
  const d = await db();
  const p = await d.query.hubParcels.findFirst({ where: eq(hubParcels.id, parcelId) });
  if (!p || p.status !== "qc_failed") throw new OrderError("Only a parcel that failed QC can be sent back.");
  await d
    .update(hubParcels)
    .set({ status: "expected", receivedAt: null, sentAt: null, courier: null, trackingNumber: null, trackingUrl: null, bin: null, qcNotes: `${p.qcNotes ?? ""}\nSent back to the seller: ${note}`.trim() })
    .where(eq(hubParcels.id, p.id));
  await event(p.orderId, "hub_sent_back", `${p.senderLabel}: a piece went back to the seller to be put right. We'll keep you posted.`, { actorUserId: actor.userId, vendorOrderId: p.vendorOrderId });
}

// ── Hub: consolidation decisions ────────────────────────────────────────────

export async function decideConsolidation(orderId: string, actor: Actor, decision: "wait" | "ship_partial", note: string | null) {
  const d = await db();
  const order = await d.query.orders.findFirst({ where: eq(orders.id, orderId), with: { fulfilment: true } });
  if (!order || order.fulfilment?.mode !== "hub") throw new OrderError("This order isn't consolidated at a hub.");
  const { fulfilment } = await getSettings(["fulfilment"]);
  const parcels = await orderParcels(orderId);
  if (decision === "ship_partial") {
    const check = partialShipmentCheck(parcels, new Date(), fulfilment.lateThresholdDays);
    if (!check.allowed) throw new OrderError(check.reason);
  }
  await d.update(orderFulfilments).set({ decision, decisionNote: note, decisionAt: new Date(), decisionById: actor.userId }).where(eq(orderFulfilments.orderId, orderId));
  const late = parcels.filter((p) => !["received", "qc_passed", "qc_failed", "packed", "shipped", "cancelled", "returned_to_seller"].includes(p.status)).map((p) => p.senderLabel);
  const message =
    decision === "wait"
      ? `${late.length ? `${late.join(", ")} need${late.length === 1 ? "s" : ""} a little more time.` : "One seller needs a little more time."} We're keeping your order at our hub so everything arrives in one box.`
      : "We're sending the items that are ready now. The rest follows in a second parcel as soon as it arrives — any extra shipping is only charged if you approve it.";
  await event(orderId, `hub_decision_${decision}`, message, { actorUserId: actor.userId });
  await notify(order.userId, { kind: "order", title: `${order.number}: ${decision === "wait" ? "a short delay" : "shipping what's ready"}`, link: `/account/orders/${order.number}` });
  await sendEmail({
    to: order.email,
    subject: decision === "wait" ? `${order.number}: a short delay` : `${order.number}: shipping the ready items now`,
    template: `hub_decision_${decision}`,
    body: `${message}${note ? `\n\nNote from our team: ${note}` : ""}\n\n${appUrl()}/account/orders/${order.number}`,
  });
}

// ── Hub: pack & ship ────────────────────────────────────────────────────────

export type PackInput = {
  parcelIds: string[];
  weightG: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  courierName: string;
  serviceName?: string | null;
  useAdapter: boolean;
  trackingNumber?: string | null;
  notes?: string | null;
};

/** Cheapest active international rate of the courier for the destination and chargeable weight (PKR). Null = pending. */
export async function rateForBox(courierName: string, destination: string, chargeableG: number): Promise<{ amountPkr: number; serviceName: string | null; transitDaysMax: number | null } | null> {
  const d = await db();
  const rows = await d
    .select({ r: shippingRates, active: couriers.isActive })
    .from(shippingRates)
    .leftJoin(couriers, eq(couriers.id, shippingRates.courierId))
    .where(and(eq(shippingRates.destinationCountry, destination), eq(shippingRates.courier, courierName.trim())));
  const fx = await getFxTable();
  const fits = rows
    .filter(({ r, active }) => active !== false && r.status === "active" && r.amount != null && !r.zone && r.minWeightG <= chargeableG && chargeableG <= r.maxWeightG)
    .map(({ r }) => {
      const rateFx = fx[r.currency];
      return rateFx ? { amountPkr: convert(r.amount!, rateFx, fx.PKR!), serviceName: r.serviceName, transitDaysMax: r.transitDaysMax } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => a.amountPkr - b.amountPkr);
  return fits[0] ?? null;
}

export async function packAndShip(orderId: string, actor: Actor, input: PackInput) {
  const d = await db();
  const order = await d.query.orders.findFirst({ where: eq(orders.id, orderId), with: { fulfilment: { with: { hub: true } }, items: { with: { product: true } }, brandItems: true, shipments: true } });
  if (!order || order.fulfilment?.mode !== "hub" || !order.fulfilment.hub) throw new OrderError("This order isn't consolidated at a hub.");
  if (order.status === "disputed") throw new OrderError("A case is open on this order — resolve it first.");
  if (!(input.weightG > 0) || !(input.lengthCm > 0 && input.widthCm > 0 && input.heightCm > 0)) throw new OrderError("Enter the packed box's weight and dimensions.");
  const hub = order.fulfilment.hub;
  const parcels = await orderParcels(orderId);
  const included = parcels.filter((p) => input.parcelIds.includes(p.id));
  if (!included.length) throw new OrderError("Choose the parcels going into this box.");
  const notReady = included.filter((p) => p.status !== "qc_passed");
  if (notReady.length) throw new OrderError(`${notReady.map((p) => p.reference).join(", ")} ${notReady.length === 1 ? "hasn't" : "haven't"} passed QC.`);
  const remaining = parcels.filter((p) => !input.parcelIds.includes(p.id) && !["shipped", "packed", "cancelled", "returned_to_seller"].includes(p.status));
  const partial = remaining.length > 0;
  if (partial && order.fulfilment.decision !== "ship_partial") throw new OrderError("Some items haven't arrived. Record “Ship ready items now” on the consolidation board first (the buyer is told), or wait.");
  if (!input.courierName.trim()) throw new OrderError("Choose the courier.");

  const { fulfilment } = await getSettings(["fulfilment"]);
  const volumetricG = volumetricWeightG(input.lengthCm, input.widthCm, input.heightCm, fulfilment.volumetricDivisor);
  const chargeableG = chargeableWeightG(input.weightG, volumetricG);
  const rate = await rateForBox(input.courierName, order.destinationCountry, chargeableG);

  const n = order.shipments.filter((s) => s.kind !== "direct").length + 1;
  const ref = shipmentReference(order.number, n);
  const voIds = included.map((p) => p.vendorOrderId).filter((x): x is string => !!x);
  const brandIds = included.map((p) => p.brandFulfilmentId).filter((x): x is string => !!x);
  const brandLabels = new Set(included.filter((p) => p.brandFulfilmentId).map((p) => p.brandFulfilment?.brandLabel ?? p.senderLabel));
  const artisanItems = order.items.filter((i) => voIds.includes(i.vendorOrderId));
  const brandItems = order.brandItems.filter((i) => !i.unavailable && brandLabels.has(i.brandName));
  const vendorNames = new Map(included.filter((p) => p.vendorOrderId).map((p) => [p.vendorOrderId!, p.senderLabel]));
  const docItems: ShipmentDocItem[] = [
    ...artisanItems.map((i) => ({ title: i.title, qty: i.qty, hsCode: i.hsCode, unitValue: i.unitPrice, weightG: i.product?.weightG ?? null, origin: "PK", sender: vendorNames.get(i.vendorOrderId) ?? "" })),
    ...brandItems.map((i) => ({ title: `${i.title}${i.size ? ` (${i.size})` : ""}`, qty: i.qty, hsCode: null, unitValue: i.unitPrice ?? 0, weightG: i.weightG, origin: "PK", sender: i.brandName })),
  ];
  const declared = docItems.reduce((a, i) => a + i.unitValue * i.qty, 0);

  const booking = await book(input.courierName, input.useAdapter, {
    reference: ref,
    serviceName: input.serviceName ?? rate?.serviceName ?? null,
    from: hubParty(hub),
    to: buyerParty(order),
    weightG: input.weightG,
    dimensionsCm: { length: input.lengthCm, width: input.widthCm, height: input.heightCm },
    declaredValue: { amount: declared, currency: order.currency },
    trackingNumber: input.trackingNumber ?? null,
    contents: docItems.map((i) => `${i.qty} × ${i.title}`).join(", "),
  });
  const now = new Date();
  const [box] = await d
    .insert(shipments)
    .values({
      reference: ref,
      orderId,
      kind: partial ? "partial" : "consolidated",
      status: "shipped",
      fromHubId: hub.id,
      courierId: booking.courierId,
      courierName: input.courierName.trim(),
      serviceName: input.serviceName ?? rate?.serviceName ?? null,
      provider: booking.provider,
      bookingRef: booking.bookingRef,
      trackingNumber: booking.trackingNumber,
      trackingUrl: booking.trackingUrl,
      weightG: input.weightG,
      lengthCm: String(input.lengthCm),
      widthCm: String(input.widthCm),
      heightCm: String(input.heightCm),
      volumetricWeightG: volumetricG,
      chargeableWeightG: chargeableG,
      rateCostPkr: rate?.amountPkr ?? null,
      documentItems: docItems,
      notes: input.notes ?? null,
      createdById: actor.userId,
      bookedAt: now,
      shippedAt: now,
    })
    .returning();
  const parcelOf = (voId: string) => included.find((p) => p.vendorOrderId === voId)?.id ?? null;
  const rows = [
    ...artisanItems.map((i) => ({ shipmentId: box.id, orderItemId: i.id, hubParcelId: parcelOf(i.vendorOrderId), qty: i.qty })),
    ...brandItems.map((i) => ({ shipmentId: box.id, brandOrderItemId: i.id, hubParcelId: included.find((p) => (p.brandFulfilment?.brandLabel ?? p.senderLabel) === i.brandName)?.id ?? null, qty: i.qty })),
  ];
  if (rows.length) await d.insert(shipmentItems).values(rows);
  await d.update(hubParcels).set({ status: "shipped", shipmentId: box.id }).where(inArray(hubParcels.id, included.map((p) => p.id)));

  // Drive the artisan sub-orders (status, escrow window) — quietly: the buyer gets one message for the box.
  for (const voId of voIds)
    await vendorOrderAction(voId, { type: "ship", courier: box.courierName!, trackingNumber: box.trackingNumber!, trackingUrl: box.trackingUrl, packageWeightG: input.weightG }, { ...actor, isStaff: true }, { quiet: true });
  if (brandIds.length) {
    const { advanceBrandFulfilment } = await import("@/lib/brands/orders");
    const allBrand = order.kind === "brand" && !partial;
    if (allBrand) await advanceBrandFulfilment(orderId, "all", { step: "dispatched", courier: box.courierName!, trackingNumber: box.trackingNumber! }, actor.userId);
    else for (const id of brandIds) await advanceBrandFulfilment(orderId, id, { step: "dispatched", courier: box.courierName!, trackingNumber: box.trackingNumber! }, actor.userId);
  }
  if (order.kind !== "brand") {
    const what = partial ? "The ready items left our hub" : "Your order left our hub in one box";
    await event(orderId, partial ? "hub_shipped_partial" : "hub_shipped", `${what} with ${box.courierName} — tracking ${box.trackingNumber}`, { actorUserId: actor.userId });
    await notify(order.userId, { kind: "order", title: `${order.number}: shipped from our hub`, link: `/account/orders/${order.number}` });
    await sendEmail({
      to: order.email,
      subject: partial ? `${order.number}: the first part of your order has shipped` : `Your Wahbayaan order ${order.number} has shipped`,
      template: partial ? "hub_shipped_partial" : "hub_shipped",
      body: `${what} with ${box.courierName}.\n\nTracking number: ${box.trackingNumber}${box.trackingUrl ? `\nTrack it: ${box.trackingUrl}` : ""}${partial ? "\n\nThe rest of your order follows as soon as it reaches our hub." : ""}\n\nYour payment stays held until it arrives. Follow your order here:\n\n${appUrl()}/account/orders/${order.number}`,
    });
  }

  // Final box vs. what the buyer paid: never charged silently — staff may ask the buyer to approve the difference.
  const fx: FxQuote = { currency: order.currency as Currency, pkrPerUnit: Number(order.fxPkrPerUnit), source: order.fxSource, status: "manual" };
  const finalShipping = rate ? convertFromPkr(rate.amountPkr, fx) : null;
  return { shipment: box, partial, volumetricG, chargeableG, rate, finalShipping, chargedShipping: order.shippingAmount };
}

export async function markShipmentDelivered(shipmentId: string, actor: Actor) {
  const d = await db();
  const box = await d.query.shipments.findFirst({ where: eq(shipments.id, shipmentId) });
  if (!box) throw new OrderError("Shipment not found");
  if (box.status !== "shipped") throw new OrderError("Only a shipped parcel can be marked delivered.");
  if (box.kind === "direct" && box.vendorOrderId) {
    await vendorOrderAction(box.vendorOrderId, { type: "delivered" }, { ...actor, isStaff: true });
  } else {
    const parcels = await d.select().from(hubParcels).where(eq(hubParcels.shipmentId, box.id));
    const voIds = parcels.map((p) => p.vendorOrderId).filter((x): x is string => !!x);
    for (const voId of voIds) {
      const vo = await d.query.vendorOrders.findFirst({ where: eq(vendorOrders.id, voId) });
      if (vo?.status === "shipped") await vendorOrderAction(voId, { type: "delivered" }, { ...actor, isStaff: true }, { quiet: true });
    }
    const brandIds = parcels.map((p) => p.brandFulfilmentId).filter((x): x is string => !!x);
    if (brandIds.length) {
      const { advanceBrandFulfilment } = await import("@/lib/brands/orders");
      for (const id of brandIds) await advanceBrandFulfilment(box.orderId, id, { step: "delivered" }, actor.userId);
    }
  }
  await d.update(shipments).set({ status: "delivered", deliveredAt: new Date() }).where(eq(shipments.id, box.id));
}

// ── Extra shipping (approved by the buyer, then paid) ──────────────────────

export async function createFulfilmentQuote(orderId: string, actor: Actor, input: { kind: "partial_shipment" | "final_weight"; amount: number; note?: string | null }) {
  const d = await db();
  const order = await d.query.orders.findFirst({ where: eq(orders.id, orderId) });
  if (!order) throw new OrderError("Order not found");
  if (order.paymentStatus !== "paid") throw new OrderError("Extra charges are only for paid orders — re-quote unpaid orders instead.");
  if (!(input.amount > 0)) throw new OrderError("Enter the extra amount.");
  const open = await d.query.fulfilmentQuotes.findFirst({ where: and(eq(fulfilmentQuotes.orderId, orderId), inArray(fulfilmentQuotes.status, ["pending", "approved"])) });
  if (open) throw new OrderError("There's already an extra charge waiting for the buyer.");
  const [q] = await d.insert(fulfilmentQuotes).values({ orderId, kind: input.kind, amount: input.amount, currency: order.currency, note: input.note ?? null, createdById: actor.userId }).returning();
  const amount = formatMoney(input.amount, order.currency as Currency);
  const why = input.kind === "partial_shipment" ? "sending your order in two boxes" : "the packed box weighing more than estimated";
  await event(orderId, "extra_shipping_quote", `Extra shipping of ${amount} for ${why} — waiting for your approval. Nothing is charged unless you approve.`, { actorUserId: actor.userId });
  await notify(order.userId, { kind: "quote", title: `${order.number}: please approve extra shipping`, link: `/account/orders/${order.number}` });
  await sendEmail({
    to: order.email,
    subject: `${order.number}: approve extra shipping?`,
    template: "extra_shipping_quote",
    body: `Extra shipping of ${amount} applies for ${why}.${input.note ? `\n\nNote from our team: ${input.note}` : ""}\n\nNothing is charged unless you approve it on your order page:\n\n${appUrl()}/account/orders/${order.number}`,
  });
  return q;
}

export async function declineFulfilmentQuote(quoteId: string, userId: string) {
  const d = await db();
  const q = await d.query.fulfilmentQuotes.findFirst({ where: eq(fulfilmentQuotes.id, quoteId), with: { order: true } });
  if (!q || q.order.userId !== userId) throw new OrderError("Not found");
  if (q.status !== "pending" && q.status !== "approved") throw new OrderError("This charge has already been answered.");
  await d.update(fulfilmentQuotes).set({ status: "declined", respondedAt: new Date() }).where(eq(fulfilmentQuotes.id, q.id));
  await event(q.orderId, "extra_shipping_declined", "You declined the extra shipping — nothing more is charged. Our team will be in touch about the rest of your order.", { actorUserId: userId });
}

/** Buyer approves: start a payment for just the extra amount. Returns the provider redirect. */
export async function payFulfilmentQuote(quoteId: string, userId: string, origin: string) {
  const d = await db();
  const q = await d.query.fulfilmentQuotes.findFirst({ where: eq(fulfilmentQuotes.id, quoteId), with: { order: true } });
  if (!q || q.order.userId !== userId) throw new OrderError("Not found");
  if (q.status !== "pending" && q.status !== "approved") throw new OrderError("This charge has already been answered.");
  const start = await startCheckout({
    orderId: q.orderId,
    orderNumber: q.order.number,
    email: q.order.email,
    currency: q.currency,
    amount: q.amount,
    description: `Extra shipping for order ${q.order.number}`,
    successUrl: `${origin}/account/orders/${q.order.number}?extra=paid`,
    cancelUrl: `${origin}/account/orders/${q.order.number}`,
    metadata: { fulfilmentQuoteId: q.id },
  });
  await d.update(fulfilmentQuotes).set({ status: "approved", respondedAt: new Date(), paymentRef: start.providerRef }).where(eq(fulfilmentQuotes.id, q.id));
  await d.insert(payments).values({ orderId: q.orderId, provider: start.provider, providerRef: start.providerRef, amount: q.amount, currency: q.currency, status: "pending", mode: start.mode });
  return start.provider === "test" ? `/checkout/test-payment/extra?quote=${q.id}` : start.redirectUrl;
}

/** Payment webhook / simulator: the extra amount is now held with the rest of the order. */
export async function markFulfilmentQuotePaid(quoteId: string) {
  const d = await db();
  const q = await d.query.fulfilmentQuotes.findFirst({ where: eq(fulfilmentQuotes.id, quoteId), with: { order: true } });
  if (!q || q.status === "paid") return;
  if (q.status !== "approved") throw new OrderError("This charge wasn't approved.");
  await d.update(fulfilmentQuotes).set({ status: "paid", paidAt: new Date() }).where(eq(fulfilmentQuotes.id, q.id));
  if (q.paymentRef) await d.update(payments).set({ status: "succeeded" }).where(eq(payments.providerRef, q.paymentRef));
  await d
    .update(orders)
    .set({ total: sql`${orders.total} + ${q.amount}`, shippingAmount: sql`coalesce(${orders.shippingAmount}, 0) + ${q.amount}` })
    .where(eq(orders.id, q.orderId));
  await event(q.orderId, "extra_shipping_paid", `Extra shipping of ${formatMoney(q.amount, q.currency as Currency)} paid — held with the rest of your payment.`);
  await sendEmail({ to: q.order.email, subject: `${q.order.number}: extra shipping paid`, template: "extra_shipping_paid", body: `Thank you — ${formatMoney(q.amount, q.currency as Currency)} for extra shipping on order ${q.order.number} is held with the rest of your payment.` });
}

// ── Returns ─────────────────────────────────────────────────────────────────

export type ReturnEligibility = { ok: true; windowEndsAt: Date | null; destination: "seller" | "hub" | "forwarder" } | { ok: false; reason: string };

/**
 * Returns are possible after delivery, inside the buyer-protection window
 * (Admin → Settings). While that window is still pending, returns are possible
 * until the buyer's payment is released.
 */
export function returnEligibility(
  order: { status: string; deliveredAt: Date | null; fundsState: string; destinationCountry: string },
  fulfilmentMode: "direct" | "hub" | null,
  protection: { returnWindowDays: number | null; status: "pending" | "active" },
  now = new Date(),
  forwarder = false,
): ReturnEligibility {
  if (!["delivered", "completed"].includes(order.status) || !order.deliveredAt) return { ok: false, reason: "Returns open once your order is delivered." };
  const destination = order.destinationCountry === "PK" || fulfilmentMode !== "hub" ? "seller" : forwarder ? "forwarder" : "hub";
  if (protection.status === "active" && protection.returnWindowDays != null) {
    const ends = addDays(order.deliveredAt, protection.returnWindowDays);
    if (now > ends) return { ok: false, reason: `The ${protection.returnWindowDays}-day return window ended on ${formatDate(ends)}.` };
    return { ok: true, windowEndsAt: ends, destination };
  }
  if (order.fundsState !== "held" && order.fundsState !== "frozen") return { ok: false, reason: "Your payment has already been released, so returns are handled through support." };
  return { ok: true, windowEndsAt: null, destination };
}

export async function requestReturn(orderNumber: string, userId: string, input: { items: ReturnItem[]; reason: string; description: string; photos: string[]; vendorOrderId?: string | null }) {
  const d = await db();
  const order = await d.query.orders.findFirst({ where: eq(orders.number, orderNumber), with: { fulfilment: true, returnRequests: true } });
  if (!order || order.userId !== userId) throw new OrderError("Order not found");
  const { buyer_protection } = await getSettings(["buyer_protection"]);
  const elig = returnEligibility(order, order.fulfilment?.mode ?? null, buyer_protection);
  if (!elig.ok) throw new OrderError(elig.reason);
  if (order.returnRequests.some((r) => ["requested", "approved", "in_transit", "received"].includes(r.status))) throw new OrderError("There's already an open return for this order.");
  if (!input.items.length) throw new OrderError("Choose what you'd like to return.");
  if (input.description.trim().length < 10) throw new OrderError("Tell us a little about why (at least 10 characters).");
  const number = reference("RET");
  const [row] = await d
    .insert(returnRequests)
    .values({
      number,
      orderId: order.id,
      userId,
      vendorOrderId: input.vendorOrderId ?? null,
      items: input.items,
      reason: input.reason,
      description: input.description.trim(),
      photos: input.photos,
      destination: elig.destination,
      returnHubId: elig.destination === "hub" ? order.fulfilment?.hubId ?? null : null,
    })
    .returning();
  // Pause the automatic escrow release while the return is open (nothing is paid out to the seller meanwhile).
  await d.update(orders).set({ autoReleaseAt: null }).where(and(eq(orders.id, order.id), eq(orders.fundsState, "held")));
  await event(order.id, "return_requested", `Return ${number} requested — our team will reply with instructions.`, { actorUserId: userId });
  await sendEmail({
    to: order.email,
    subject: `Return ${number} received`,
    template: "return_requested",
    body: `We've received your return request ${number} for order ${order.number}. Our team reviews it and emails you where to send the item${input.items.length === 1 ? "" : "s"}. Please keep the packaging.`,
  });
  return row;
}

export async function decideReturn(returnId: string, actor: Actor, approve: boolean, note: string | null) {
  const d = await db();
  const r = await d.query.returnRequests.findFirst({ where: eq(returnRequests.id, returnId), with: { order: true, returnHub: true, vendorOrder: { with: { vendor: true } } } });
  if (!r) throw new OrderError("Return not found");
  if (r.status !== "requested") throw new OrderError("This return has already been decided.");
  await d.update(returnRequests).set({ status: approve ? "approved" : "rejected", staffNote: note, decidedById: actor.userId, decidedAt: new Date() }).where(eq(returnRequests.id, r.id));
  if (!approve) {
    const { escrow } = await getSettings(["escrow"]);
    await d
      .update(orders)
      .set({ autoReleaseAt: new Date(Date.now() + escrow.autoReleaseDaysAfterDelivery * 86_400_000) })
      .where(and(eq(orders.id, r.orderId), eq(orders.status, "delivered"), eq(orders.fundsState, "held")));
  }
  const where =
    r.destination === "hub" && r.returnHub
      ? `our hub (${r.returnHub.name}, ${r.returnHub.city}) — the address and your return reference ${r.number} are on your order page`
      : r.destination === "forwarder"
        ? "our partner in your country — we'll email the address"
        : `the seller${r.vendorOrder ? ` (${r.vendorOrder.vendor.displayName})` : ""} — our team emails the address and arranges the courier`;
  const message = approve ? `Return ${r.number} approved. Please send it to ${where}.` : `Return ${r.number} wasn't approved${note ? `: ${note}` : "."}`;
  await event(r.orderId, approve ? "return_approved" : "return_rejected", message, { actorUserId: actor.userId });
  await sendEmail({ to: r.order.email, subject: `Return ${r.number} ${approve ? "approved" : "update"}`, template: approve ? "return_approved" : "return_rejected", body: `${message}${note && approve ? `\n\nNote from our team: ${note}` : ""}\n\n${appUrl()}/account/orders/${r.order.number}` });
}

export async function updateReturn(returnId: string, actor: Actor, step: { type: "in_transit"; courier: string | null; trackingNumber: string | null } | { type: "received" } | { type: "close" }) {
  const d = await db();
  const r = await d.query.returnRequests.findFirst({ where: eq(returnRequests.id, returnId) });
  if (!r) throw new OrderError("Return not found");
  if (step.type === "in_transit") {
    if (r.status !== "approved") throw new OrderError("Approve the return first.");
    await d.update(returnRequests).set({ status: "in_transit", courier: step.courier, trackingNumber: step.trackingNumber }).where(eq(returnRequests.id, r.id));
  } else if (step.type === "received") {
    if (!["approved", "in_transit"].includes(r.status)) throw new OrderError("Approve the return first.");
    await d.update(returnRequests).set({ status: "received", receivedAt: new Date() }).where(eq(returnRequests.id, r.id));
    await event(r.orderId, "return_received", `We've received your return ${r.number}. Your refund is next.`, { actorUserId: actor.userId });
  } else {
    await d.update(returnRequests).set({ status: "closed" }).where(eq(returnRequests.id, r.id));
  }
}

/** Refund through the existing refund flow (same provider refund, events and email). */
export async function refundReturn(returnId: string, actor: Actor, amount: number) {
  const d = await db();
  const r = await d.query.returnRequests.findFirst({ where: eq(returnRequests.id, returnId) });
  if (!r) throw new OrderError("Return not found");
  if (!["received", "approved", "in_transit"].includes(r.status)) throw new OrderError("Approve the return before refunding it.");
  await refundOrder(r.orderId, amount, `Return ${r.number}`, { userId: actor.userId });
  const [refund] = await d.query.refunds.findMany({ where: (t, { eq: e }) => e(t.orderId, r.orderId), orderBy: (t, { desc: dd }) => dd(t.createdAt), limit: 1 });
  await d.update(returnRequests).set({ status: "refunded", refundId: refund?.id ?? null }).where(eq(returnRequests.id, r.id));
}

// ── Views ───────────────────────────────────────────────────────────────────

/** Everything the buyer / admin order pages need about fulfilment. Null fulfilment = an older order (direct). */
export async function getOrderFulfilmentView(orderId: string) {
  const d = await db();
  const [fulfilment, parcels, outbound, quotes, returns] = await Promise.all([
    d.query.orderFulfilments.findFirst({ where: eq(orderFulfilments.orderId, orderId), with: { hub: true } }),
    orderParcels(orderId),
    d.query.shipments.findMany({ where: eq(shipments.orderId, orderId), with: { items: true }, orderBy: asc(shipments.createdAt) }),
    d.query.fulfilmentQuotes.findMany({ where: eq(fulfilmentQuotes.orderId, orderId), orderBy: desc(fulfilmentQuotes.createdAt) }),
    d.query.returnRequests.findMany({ where: eq(returnRequests.orderId, orderId), orderBy: desc(returnRequests.createdAt), with: { returnHub: true } }),
  ]);
  const live = outbound.filter((s) => s.status !== "cancelled");
  // Per-seller "leaves by" date for direct parcels: paid date + that seller's slowest item.
  const order = await d.query.orders.findFirst({ where: eq(orders.id, orderId), columns: { paidAt: true }, with: { items: { columns: { vendorOrderId: true }, with: { product: { columns: { availability: true, timeToMakeDays: true, dispatchDays: true } } } } } });
  const sellerDispatch: Record<string, Date | null> = {};
  if (order?.paidAt) {
    const byVo = new Map<string, TimedItem[]>();
    for (const i of order.items) byVo.set(i.vendorOrderId, [...(byVo.get(i.vendorOrderId) ?? []), { availability: i.product?.availability ?? "ready_to_ship", timeToMakeDays: i.product?.timeToMakeDays ?? null, dispatchDays: i.product?.dispatchDays ?? null }]);
    for (const [vo, items] of byVo) {
      const days = slowestItemDays(items);
      sellerDispatch[vo] = days == null ? null : addDays(order.paidAt, days);
    }
  }
  return { fulfilment: fulfilment ?? null, hub: fulfilment?.hub ?? null, parcels, shipments: live, quotes, returns, progress: consolidationProgress(parcels), sellerDispatch };
}

export type FulfilmentView = Awaited<ReturnType<typeof getOrderFulfilmentView>>;

/** Hub screens: parcels at one hub (or all hubs) in the given statuses, with order and seller info. */
export async function hubParcelList(statuses: HubParcelStatus[], hubId?: string | null) {
  const d = await db();
  return d
    .select({ p: hubParcels, orderNumber: orders.number, orderStatus: orders.status, destination: orders.destinationCountry, hubName: hubs.name, isDemo: orders.isDemo })
    .from(hubParcels)
    .innerJoin(orders, eq(orders.id, hubParcels.orderId))
    .innerJoin(hubs, eq(hubs.id, hubParcels.hubId))
    .where(and(inArray(hubParcels.status, statuses), hubId ? eq(hubParcels.hubId, hubId) : undefined, notInArray(orders.status, ["cancelled", "refunded"])))
    .orderBy(asc(hubParcels.expectedBy), asc(hubParcels.reference));
}

/** Orders still consolidating at a hub (something not yet shipped). */
export async function consolidationBoard(hubId?: string | null) {
  const d = await db();
  const rows = await d
    .select({ f: orderFulfilments, o: orders })
    .from(orderFulfilments)
    .innerJoin(orders, eq(orders.id, orderFulfilments.orderId))
    .where(
      and(
        eq(orderFulfilments.mode, "hub"),
        hubId ? eq(orderFulfilments.hubId, hubId) : undefined,
        notInArray(orders.status, ["cancelled", "refunded", "completed", "delivered"]),
        sql`exists (select 1 from hub_parcels hp where hp.order_id = ${orders.id} and hp.status not in ('shipped','cancelled','returned_to_seller'))`,
      ),
    )
    .orderBy(asc(orders.paidAt));
  const out = [];
  for (const r of rows) out.push({ ...r, parcels: await orderParcels(r.o.id) });
  return out;
}

/** Recently shipped hub boxes and direct parcels. */
export async function shippedBoxes(limit = 50) {
  const d = await db();
  return d
    .select({ s: shipments, orderNumber: orders.number, destination: orders.destinationCountry, customer: orders.customerName })
    .from(shipments)
    .innerJoin(orders, eq(orders.id, shipments.orderId))
    .where(and(inArray(shipments.status, ["shipped", "delivered"]), or(eq(shipments.kind, "consolidated"), eq(shipments.kind, "partial"))))
    .orderBy(desc(shipments.shippedAt))
    .limit(limit);
}

/** Seller order page: how this artisan's parcel travels (no buyer amounts). */
export async function sellerFulfilment(orderId: string, vendorOrderId: string) {
  const d = await db();
  const [fulfilment, parcel, shipment] = await Promise.all([
    d.query.orderFulfilments.findFirst({ where: eq(orderFulfilments.orderId, orderId) }),
    d.query.hubParcels.findFirst({ where: eq(hubParcels.vendorOrderId, vendorOrderId), with: { hub: true } }),
    d.query.shipments.findFirst({ where: and(eq(shipments.vendorOrderId, vendorOrderId), eq(shipments.kind, "direct"), notInArray(shipments.status, ["cancelled"])), orderBy: desc(shipments.createdAt) }),
  ]);
  return { mode: fulfilment?.mode ?? "direct", parcel: parcel ?? null, shipment: shipment ?? null };
}

/** Courier names for a route and which of them can be booked through an integration. */
export async function bookingCouriers(destinationCountry: string) {
  const d = await db();
  const rows = await d.select().from(couriers).orderBy(asc(couriers.name));
  const fits = rows.filter((c) => (destinationCountry === "PK" ? c.domestic : c.international));
  const ordered = [...fits.filter((c) => c.isActive), ...fits.filter((c) => !c.isActive)];
  const { fulfilment } = await getSettings(["fulfilment"]);
  return { names: ordered.map((c) => c.name), bookable: ordered.filter((c) => c.isActive && fulfilment.courierAdapters[c.id] && fulfilment.courierAdapters[c.id] !== "manual").map((c) => c.name) };
}

/** Sellers (by vendor) — used to email a late seller from the board. */
export async function vendorContact(vendorOrderId: string) {
  const d = await db();
  const [row] = await d
    .select({ email: users.email, name: vendors.displayName, userId: users.id })
    .from(vendorOrders)
    .innerJoin(vendors, eq(vendors.id, vendorOrders.vendorId))
    .innerJoin(users, eq(users.id, vendors.userId))
    .where(eq(vendorOrders.id, vendorOrderId));
  return row ?? null;
}
