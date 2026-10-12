import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { brandItemReadiness, brandOrderItems, orderEvents, orders } from "@/lib/db/schema";
import { audit } from "@/lib/audit";
import { BrandPortalError } from "./access";

/**
 * Fulfil hook for self-listed brands.
 *
 * The brand marks ordered items "ready" in its portal; this records it
 * (`brand_item_readiness`), adds a staff-only order event, audits it and then
 * notifies any registered listeners. Collection, hubs and shipping are NOT
 * handled here — the fulfilment module subscribes with `onBrandItemsReady` and
 * takes it from there.
 */
export type BrandItemsReadyEvent = { brandId: string; orderId: string; orderNumber: string; orderItemIds: string[]; actorUserId: string; at: Date; note: string | null };
type Listener = (e: BrandItemsReadyEvent) => void | Promise<void>;

const holder = globalThis as unknown as { __wbBrandReadyListeners?: Listener[] };
const listeners: Listener[] = (holder.__wbBrandReadyListeners ??= []);

/** Subscribe to "brand marked items ready". Returns an unsubscribe function. */
export function onBrandItemsReady(fn: Listener) {
  listeners.push(fn);
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}

/** Order states in which the brand may prepare items (paid, not closed). */
export const READY_ORDER_STATUSES = ["paid", "in_fulfilment"] as const;

export async function markBrandItemsReady(input: { brandId: string; orderItemIds: string[]; actorUserId: string; note?: string | null }): Promise<BrandItemsReadyEvent> {
  const ids = [...new Set(input.orderItemIds)];
  if (!ids.length) throw new BrandPortalError("Choose at least one item.");
  const d = await db();
  const items = await d
    .select({ item: brandOrderItems, order: orders })
    .from(brandOrderItems)
    .innerJoin(orders, eq(orders.id, brandOrderItems.orderId))
    .where(and(inArray(brandOrderItems.id, ids), eq(brandOrderItems.brandId, input.brandId)));
  if (items.length !== ids.length) throw new BrandPortalError("Some of those items aren't from your brand.");
  const orderIds = new Set(items.map((i) => i.order.id));
  if (orderIds.size !== 1) throw new BrandPortalError("Mark items ready one order at a time.");
  const order = items[0].order;
  if (!(READY_ORDER_STATUSES as readonly string[]).includes(order.status)) throw new BrandPortalError(`Order ${order.number} isn't paid and open, so it can't be prepared yet.`);
  const at = new Date();
  const note = input.note?.trim() || null;
  await d
    .insert(brandItemReadiness)
    .values(ids.map((orderItemId) => ({ orderItemId, brandId: input.brandId, readyAt: at, markedById: input.actorUserId, note })))
    .onConflictDoNothing();
  const titles = items.map((i) => `${i.item.title}${i.item.size ? ` (${i.item.size})` : ""} ×${i.item.qty}`);
  await d.insert(orderEvents).values({ orderId: order.id, kind: "brand_items_ready", message: `${items[0].item.brandName} marked ready: ${titles.join(", ")}${note ? ` — “${note}”` : ""}`, actorUserId: input.actorUserId, visibleToBuyer: false });
  await audit({ actorUserId: input.actorUserId, action: "brand_order.items_ready", entity: "order", entityId: order.id, summary: `${items[0].item.brandName} marked ${ids.length} item${ids.length === 1 ? "" : "s"} ready on ${order.number}`, data: { orderItemIds: ids, note } });
  const event: BrandItemsReadyEvent = { brandId: input.brandId, orderId: order.id, orderNumber: order.number, orderItemIds: ids, actorUserId: input.actorUserId, at, note };
  for (const fn of listeners) {
    try {
      await fn(event);
    } catch (e) {
      console.error("[brand ready hook]", e);
    }
  }
  return event;
}
