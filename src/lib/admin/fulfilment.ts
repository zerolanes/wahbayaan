import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { orderEvents, orders, vendorOrders } from "@/lib/db/schema";
import { vendorOrderAction, type VendorAction } from "@/lib/commerce/orders";
import { getSettings } from "@/lib/settings";

const STEP_STATUS: Record<VendorAction["type"], string> = {
  accept: "accepted",
  start_production: "in_production",
  ready: "ready_to_ship",
  ship: "shipped",
  delivered: "delivered",
};

/**
 * Staff-side wrapper around `vendorOrderAction`.
 *
 * On the embedded single-connection database (PGlite, used in development),
 * `vendorOrderAction` deadlocks whenever the parent order's status changes: it
 * calls `getSettings()` on the shared connection while its own transaction
 * holds that connection. Until that is fixed in `src/lib/commerce/orders.ts`,
 * this wrapper applies the order-level transition first (outside any
 * transaction) so the library call only has the sub-order to update. With a
 * real Postgres (`DATABASE_URL`) the library is called directly.
 */
export async function staffVendorOrderAction(vendorOrderId: string, action: VendorAction, userId: string) {
  if (process.env.DATABASE_URL) return vendorOrderAction(vendorOrderId, action, { userId, isStaff: true });

  const d = await db();
  const vo = await d.query.vendorOrders.findFirst({ where: eq(vendorOrders.id, vendorOrderId), with: { order: true } });
  if (!vo) return vendorOrderAction(vendorOrderId, action, { userId, isStaff: true }); // let the library raise its error
  const order = vo.order;
  const siblings = await d.select().from(vendorOrders).where(eq(vendorOrders.orderId, order.id));
  const statuses = siblings.map((s) => (s.id === vendorOrderId ? STEP_STATUS[action.type] : s.status));
  let next = order.status;
  if (statuses.every((s) => s === "delivered")) next = "delivered";
  else if (statuses.every((s) => s === "shipped" || s === "delivered")) next = "shipped";
  else if (order.status === "paid") next = "in_fulfilment";
  const changes = next !== order.status && order.status !== "disputed" && ["paid", "in_fulfilment", "shipped", "delivered"].includes(order.status);
  if (!changes) return vendorOrderAction(vendorOrderId, action, { userId, isStaff: true });

  const s = await getSettings(["escrow"]);
  const deliveredPatch = next === "delivered" ? { deliveredAt: new Date(), autoReleaseAt: new Date(Date.now() + s.escrow.autoReleaseDaysAfterDelivery * 86_400_000) } : {};
  await d.update(orders).set({ status: next, ...deliveredPatch }).where(eq(orders.id, order.id));
  try {
    await vendorOrderAction(vendorOrderId, action, { userId, isStaff: true });
  } catch (err) {
    await d.update(orders).set({ status: order.status, deliveredAt: order.deliveredAt, autoReleaseAt: order.autoReleaseAt }).where(eq(orders.id, order.id));
    throw err;
  }
  if (next === "delivered")
    await d.insert(orderEvents).values({ orderId: order.id, kind: "delivered", message: "Delivered. Please confirm it arrived as described — or open a case if something is wrong." });
}
