import "server-only";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { brandFulfilments, hubParcels, shipmentItems, shipments, vendorOrders } from "@/lib/db/schema";

/**
 * Small status syncs called from the order lifecycle (src/lib/commerce/orders.ts)
 * and the brand checklist. Kept free of imports from those modules so there is
 * no import cycle.
 */

/** After a parcel is shipped / delivered through the normal artisan flow, mirror it on its shipment rows. */
export async function syncShipmentsForVendorOrder(vendorOrderId: string) {
  const d = await db();
  const vo = await d.query.vendorOrders.findFirst({ where: eq(vendorOrders.id, vendorOrderId) });
  if (!vo) return;
  // Direct parcels: one shipment per artisan sub-order.
  if (vo.status === "delivered")
    await d
      .update(shipments)
      .set({ status: "delivered", deliveredAt: vo.deliveredAt ?? new Date() })
      .where(and(eq(shipments.vendorOrderId, vendorOrderId), inArray(shipments.status, ["booked", "shipped"])));
  else if (vo.status === "shipped")
    await d.update(shipments).set({ status: "shipped", shippedAt: vo.shippedAt ?? new Date() }).where(and(eq(shipments.vendorOrderId, vendorOrderId), eq(shipments.status, "booked")));

  // Hub boxes: delivered once every artisan sub-order inside is delivered.
  const boxes = await d
    .selectDistinct({ id: shipments.id })
    .from(shipments)
    .innerJoin(hubParcels, eq(hubParcels.shipmentId, shipments.id))
    .where(and(eq(hubParcels.vendorOrderId, vendorOrderId), eq(shipments.status, "shipped")));
  for (const box of boxes) {
    const parcels = await d.select({ vo: hubParcels.vendorOrderId }).from(hubParcels).where(eq(hubParcels.shipmentId, box.id));
    const ids = parcels.map((p) => p.vo).filter((x): x is string => !!x);
    if (!ids.length) continue;
    const vos = await d.select({ status: vendorOrders.status }).from(vendorOrders).where(inArray(vendorOrders.id, ids));
    if (vos.every((v) => v.status === "delivered")) await d.update(shipments).set({ status: "delivered", deliveredAt: new Date() }).where(eq(shipments.id, box.id));
  }
}

/** Order cancelled before shipping: close its inbound parcels and unshipped boxes. */
export async function cancelFulfilment(orderId: string) {
  const d = await db();
  await d
    .update(hubParcels)
    .set({ status: "cancelled" })
    .where(and(eq(hubParcels.orderId, orderId), notInArray(hubParcels.status, ["shipped", "returned_to_seller", "cancelled"])));
  await d
    .update(shipments)
    .set({ status: "cancelled" })
    .where(and(eq(shipments.orderId, orderId), inArray(shipments.status, ["draft", "booked"])));
}

/** Brand checklist → hub parcels (staff may tick the checklist directly instead of using the hub screens). */
export async function syncBrandParcels(orderId: string) {
  const d = await db();
  const fs = await d.select().from(brandFulfilments).where(eq(brandFulfilments.orderId, orderId));
  for (const f of fs) {
    const next =
      f.status === "received_at_wahbayaan" ? "received" : f.status === "quality_checked" ? "qc_passed" : f.status === "dispatched" || f.status === "delivered" ? "shipped" : f.status === "cancelled" ? "cancelled" : null;
    if (!next) continue;
    const rank = ["expected", "in_transit", "received", "qc_passed", "packed", "shipped"];
    const rows = await d.select().from(hubParcels).where(eq(hubParcels.brandFulfilmentId, f.id));
    for (const p of rows) {
      if (next === "cancelled" || rank.indexOf(p.status) < rank.indexOf(next))
        await d
          .update(hubParcels)
          .set({ status: next, ...(next === "received" && !p.receivedAt ? { receivedAt: new Date() } : {}), ...(next === "qc_passed" && !p.qcAt ? { qcAt: new Date() } : {}) })
          .where(eq(hubParcels.id, p.id));
    }
  }
}

/** Items of an outbound shipment (for documents). */
export async function shipmentItemRows(shipmentId: string) {
  const d = await db();
  return d.select().from(shipmentItems).where(eq(shipmentItems.shipmentId, shipmentId));
}
