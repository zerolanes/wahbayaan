import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { brandOrderItems, orders, products, vendorOrders, vendors } from "@/lib/db/schema";
import { computeLandedCost, type LcItem } from "@/lib/commerce/landed-cost";
import { getRateContext } from "@/lib/commerce/rates";
import type { Currency, FxQuote } from "@/lib/money/currency";
import { dateRange, str, type SearchParams } from "./params";
import { likeTerm } from "./sql";

export const ORDER_TABS = [
  { value: "", label: "All" },
  { value: "awaiting_quote", label: "Awaiting quote" },
  { value: "quote_sent", label: "Quote sent" },
  { value: "awaiting_payment", label: "Awaiting payment" },
  { value: "paid", label: "Paid" },
  { value: "in_fulfilment", label: "In fulfilment" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "completed", label: "Completed" },
  { value: "disputed", label: "Disputed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "refunded", label: "Refunded" },
] as const;

export const ORDER_SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "value", label: "Highest value (PKR equivalent)" },
] as const;

/** Filters shared by the orders list and its CSV export (everything except status). */
export function orderConditions(params: SearchParams, opts: { includeStatus?: boolean } = {}): SQL[] {
  const conds: SQL[] = [];
  const q = str(params, "q");
  if (q) conds.push(or(ilike(orders.number, likeTerm(q)), ilike(orders.email, likeTerm(q)), ilike(orders.customerName, likeTerm(q)))!);
  const dest = str(params, "destination");
  if (dest) conds.push(eq(orders.destinationCountry, dest));
  const currency = str(params, "currency");
  if (currency) conds.push(eq(orders.currency, currency));
  const funds = str(params, "funds");
  if (funds) conds.push(sql`${orders.fundsState} = ${funds}`);
  const vendor = str(params, "artisan");
  if (vendor && /^[0-9a-f-]{36}$/i.test(vendor)) conds.push(sql`exists (select 1 from vendor_orders vo where vo.order_id = ${orders.id} and vo.vendor_id = ${vendor})`);
  if (str(params, "from") || str(params, "to")) {
    const r = dateRange(params, 3650);
    conds.push(gte(orders.createdAt, r.from), lt(orders.createdAt, r.toExclusive));
  }
  if (str(params, "gift") === "1") conds.push(eq(orders.isGift, true));
  if (str(params, "demo") === "0") conds.push(eq(orders.isDemo, false));
  if (opts.includeStatus !== false) {
    const status = str(params, "status");
    if (status) conds.push(sql`${orders.status} = ${status}`);
  }
  return conds;
}

export function orderSort(params: SearchParams) {
  const s = str(params, "sort");
  if (s === "oldest") return [asc(orders.createdAt)];
  if (s === "value") return [sql`${orders.total} * ${orders.fxPkrPerUnit} desc`, desc(orders.createdAt)];
  return [desc(orders.createdAt)];
}

export async function listOrders(params: SearchParams, page: number, pageSize: number) {
  const d = await db();
  const where = and(...orderConditions(params));
  const [rows, [{ n }]] = await Promise.all([
    d
      .select()
      .from(orders)
      .where(where)
      .orderBy(...orderSort(params))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    d.select({ n: sql<number>`count(*)::int` }).from(orders).where(where),
  ]);
  const vos = rows.length
    ? await d
        .select({ orderId: vendorOrders.orderId, vendorId: vendors.id, name: vendors.displayName, status: vendorOrders.status })
        .from(vendorOrders)
        .innerJoin(vendors, eq(vendors.id, vendorOrders.vendorId))
        .where(inArray(vendorOrders.orderId, rows.map((r) => r.id)))
    : [];
  // Pakistani Brands orders: show the brands Wahbayaan buys from in the same column.
  const brandRows = rows.some((r) => r.kind === "brand")
    ? await d
        .selectDistinct({ orderId: brandOrderItems.orderId, name: brandOrderItems.brandName })
        .from(brandOrderItems)
        .where(inArray(brandOrderItems.orderId, rows.filter((r) => r.kind === "brand").map((r) => r.id)))
    : [];
  return {
    rows: rows.map((o) => ({
      ...o,
      vendors:
        o.kind === "brand"
          ? brandRows.filter((b) => b.orderId === o.id).map((b) => ({ orderId: o.id, vendorId: "", name: `${b.name} (bought by Wahbayaan)`, status: "pending" as const }))
          : vos.filter((v) => v.orderId === o.id),
    })),
    total: Number(n),
  };
}

export async function orderStatusCounts(params: SearchParams) {
  const d = await db();
  const rows = await d
    .select({ status: orders.status, n: sql<number>`count(*)::int` })
    .from(orders)
    .where(and(...orderConditions(params, { includeStatus: false })))
    .groupBy(orders.status);
  const map = Object.fromEntries(rows.map((r) => [r.status, Number(r.n)])) as Record<string, number>;
  map[""] = rows.reduce((a, r) => a + Number(r.n), 0);
  return map;
}

/**
 * What the current rate tables would charge for an order (in the order's
 * currency, at the FX rate recorded on the order). Pending lines stay pending.
 */
export async function rateTableEstimate(orderId: string) {
  const d = await db();
  const order = await d.query.orders.findFirst({ where: eq(orders.id, orderId), with: { items: true } });
  if (!order) return null;
  const productIds = order.items.map((i) => i.productId).filter((x): x is string => !!x);
  const prods = productIds.length ? await d.query.products.findMany({ where: inArray(products.id, productIds), with: { category: true } }) : [];
  const items: LcItem[] = order.items.map((i) => {
    const p = prods.find((x) => x.id === i.productId);
    return {
      productId: i.productId ?? i.id,
      vendorId: i.vendorId,
      categoryId: p?.categoryId ?? "",
      hsCode: i.hsCode ?? p?.hsCodeOverride ?? p?.category.hsCode ?? null,
      title: i.title,
      unitPricePkr: i.unitPricePkr,
      qty: i.qty,
      weightG: p?.weightG ?? null,
      availability: p?.availability ?? "ready_to_ship",
      timeToMakeDays: p?.timeToMakeDays ?? null,
      dispatchDays: p?.dispatchDays ?? null,
    };
  });
  const rc = await getRateContext(order.destinationCountry);
  const fx: FxQuote = { currency: order.currency as Currency, pkrPerUnit: Number(order.fxPkrPerUnit), source: order.fxSource, status: /placeholder/i.test(order.fxSource) ? "placeholder" : "manual" };
  return computeLandedCost({
    items,
    destination: order.destinationCountry,
    fx,
    fxTable: rc.fxTable,
    shippingRates: rc.shippingRates,
    dutyRates: rc.dutyRates,
    handling: rc.handling,
    giftWrap: order.giftWrap ? { selected: true, setting: rc.giftWrap } : undefined,
  });
}

/** Parcels of an order with the shipping facts staff need to quote them. */
export async function parcelsForOrder(orderId: string) {
  const d = await db();
  const vos = await d.query.vendorOrders.findMany({ where: eq(vendorOrders.orderId, orderId), with: { vendor: true, items: { with: { product: true } } } });
  return vos.map((vo) => {
    const missingWeight = vo.items.filter((i) => !i.product?.weightG);
    const missingDims = vo.items.filter((i) => !i.product?.widthCm || !i.product?.heightCm || !i.product?.depthCm);
    const weightG = vo.items.reduce((a, i) => a + (i.product?.weightG ?? 0) * i.qty, 0);
    return { ...vo, weightG, missingWeight, missingDims };
  });
}
