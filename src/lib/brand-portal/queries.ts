import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { brandCollections, brandFulfilments, brandItemReadiness, brandOrderItems, brandProductImages, brandProducts, brandProductVariants, orders } from "@/lib/db/schema";
import { query } from "@/lib/admin/sql";
import { READY_ORDER_STATUSES } from "./fulfil";

/** Brand portal reads. Every query is scoped by the signed-in brand's id. Amounts are PKR. */

export async function portalCounts(brandId: string) {
  const [row] = await query<{ drafts: number; live: number; hidden: number; to_prepare: number }>(sql`
    select
      (select count(*)::int from brand_products where brand_id = ${brandId} and status = 'draft') as drafts,
      (select count(*)::int from brand_products where brand_id = ${brandId} and status = 'published') as live,
      (select count(*)::int from brand_products where brand_id = ${brandId} and status = 'hidden') as hidden,
      (select count(*)::int from brand_order_items i join orders o on o.id = i.order_id
         left join brand_item_readiness r on r.order_item_id = i.id
         where i.brand_id = ${brandId} and o.status in ('paid','in_fulfilment') and r.order_item_id is null) as to_prepare`);
  return { drafts: row?.drafts ?? 0, live: row?.live ?? 0, hidden: row?.hidden ?? 0, toPrepare: row?.to_prepare ?? 0 };
}

export async function portalProducts(brandId: string) {
  const d = await db();
  const rows = await d.select().from(brandProducts).where(eq(brandProducts.brandId, brandId)).orderBy(desc(brandProducts.updatedAt));
  const ids = rows.map((r) => r.id);
  const [images, variants] = ids.length
    ? await Promise.all([
        d.select().from(brandProductImages).where(inArray(brandProductImages.productId, ids)).orderBy(asc(brandProductImages.sort)),
        d.select().from(brandProductVariants).where(inArray(brandProductVariants.productId, ids)).orderBy(asc(brandProductVariants.sort)),
      ])
    : [[], []];
  return rows.map((p) => {
    const vars = variants.filter((v) => v.productId === p.id);
    const prices = vars.map((v) => v.pricePkr ?? p.pricePkr);
    const stocks = vars.map((v) => v.stockQty);
    return {
      ...p,
      images: images.filter((i) => i.productId === p.id),
      variants: vars,
      minPkr: prices.length ? Math.min(...prices) : p.pricePkr,
      maxPkr: prices.length ? Math.max(...prices) : p.pricePkr,
      stockTotal: stocks.some((s) => s == null) ? null : stocks.reduce<number>((a, s) => a + (s ?? 0), 0),
      soldOut: vars.length > 0 && vars.every((v) => !v.available || v.stockQty === 0),
    };
  });
}

export async function portalProduct(brandId: string, productId: string) {
  const d = await db();
  const p = await d.query.brandProducts.findFirst({ where: and(eq(brandProducts.id, productId), eq(brandProducts.brandId, brandId)) });
  if (!p) return null;
  const [images, variants] = await Promise.all([
    d.select().from(brandProductImages).where(eq(brandProductImages.productId, p.id)).orderBy(asc(brandProductImages.sort)),
    d.select().from(brandProductVariants).where(eq(brandProductVariants.productId, p.id)).orderBy(asc(brandProductVariants.sort)),
  ]);
  return { ...p, images, variants };
}

export async function portalCollections(brandId: string) {
  const d = await db();
  const [cols, counts] = await Promise.all([
    d.select().from(brandCollections).where(eq(brandCollections.brandId, brandId)).orderBy(asc(brandCollections.sort), asc(brandCollections.name)),
    d.select({ name: brandProducts.collection, n: sql<number>`count(*)::int` }).from(brandProducts).where(eq(brandProducts.brandId, brandId)).groupBy(brandProducts.collection),
  ]);
  return cols.map((c) => ({ ...c, productCount: Number(counts.find((x) => x.name === c.name)?.n ?? 0) }));
}

/**
 * Ordered items for this brand, grouped by order. Only orders the buyer has paid
 * for are shown; the buyer's personal details stay with Wahbayaan.
 */
export async function portalOrders(brandId: string) {
  const d = await db();
  const rows = await d
    .select({
      item: brandOrderItems,
      order: { id: orders.id, number: orders.number, status: orders.status, paidAt: orders.paidAt, createdAt: orders.createdAt, destination: orders.destinationCountry },
      readyAt: brandItemReadiness.readyAt,
    })
    .from(brandOrderItems)
    .innerJoin(orders, eq(orders.id, brandOrderItems.orderId))
    .leftJoin(brandItemReadiness, eq(brandItemReadiness.orderItemId, brandOrderItems.id))
    .where(and(eq(brandOrderItems.brandId, brandId), sql`${orders.status} in ('paid','in_fulfilment','shipped','delivered','completed')`))
    .orderBy(desc(orders.createdAt));
  const fulfilments = rows.length
    ? await d.select().from(brandFulfilments).where(and(eq(brandFulfilments.brandId, brandId), inArray(brandFulfilments.orderId, [...new Set(rows.map((r) => r.order.id))])))
    : [];
  const byOrder = new Map<string, { order: (typeof rows)[number]["order"]; fulfilment: (typeof fulfilments)[number] | null; items: { item: (typeof rows)[number]["item"]; readyAt: Date | null }[]; canPrepare: boolean }>();
  for (const r of rows) {
    const g = byOrder.get(r.order.id) ?? { order: r.order, fulfilment: fulfilments.find((f) => f.orderId === r.order.id) ?? null, items: [], canPrepare: (READY_ORDER_STATUSES as readonly string[]).includes(r.order.status) };
    g.items.push({ item: r.item, readyAt: r.readyAt });
    byOrder.set(r.order.id, g);
  }
  return [...byOrder.values()];
}
