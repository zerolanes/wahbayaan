import "server-only";
import { sql } from "drizzle-orm";
import { dateRange, type SearchParams } from "./params";
import { byDestination, gmvByMonth, landedCostAverages, refundDisputeRates, type LineStatus, type ReportOrder } from "./reports";
import { query } from "./sql";

/**
 * Report data for a date range (default: the last 12 months). Orders are
 * selected by creation date; GMV is counted on paid orders by payment date.
 */
export function reportRange(params: SearchParams) {
  return dateRange(params, 365);
}

export async function reportData(params: SearchParams) {
  const r = reportRange(params);
  const from = r.from.toISOString();
  const to = r.toExclusive.toISOString();
  // `from`/`to` are ISO strings built from validated dates, so inlining them is safe.
  const inRange = (col: string) => sql.raw(`${col} >= '${from}' and ${col} < '${to}'`);

  const [orderRows, categories, artisans, refundRows, disputeRows, disputeReasons, payoutRows] = await Promise.all([
    query<{
      created_at: Date;
      paid_at: Date | null;
      status: string;
      currency: string;
      fx: string;
      destination: string;
      items_subtotal: string;
      total: string;
      discount_amount: string;
      shipping_amount: string | null;
      shipping_status: LineStatus;
      duty_amount: string | null;
      duty_status: LineStatus;
      import_tax_amount: string | null;
      import_tax_status: LineStatus;
      handling_amount: string | null;
      handling_status: LineStatus;
    }>(sql`
      select created_at, paid_at, status, currency, fx_pkr_per_unit as fx, destination_country as destination, items_subtotal, total, discount_amount,
        shipping_amount, shipping_status, duty_amount, duty_status, import_tax_amount, import_tax_status, handling_amount, handling_status
      from orders where (${inRange("created_at")}) or (${inRange("paid_at")})`),
    query<{ id: string; name: string; orders: number; units: number; pkr: string }>(sql`
      select c.id, c.name, count(distinct o.id)::int as orders, sum(oi.qty)::int as units, sum(oi.unit_price_pkr * oi.qty)::bigint as pkr
      from order_items oi join orders o on o.id = oi.order_id join products p on p.id = oi.product_id join categories c on c.id = p.category_id
      where o.paid_at is not null and ${inRange("o.paid_at")} and o.status not in ('refunded','cancelled')
      group by c.id, c.name order by pkr desc`),
    query<{ id: string; name: string; is_demo: boolean; orders: number; cancelled: number; gross: string; commission: string; commission_pending: number; net: string; disputes: number; rating: string | null; reviews: number }>(sql`
      select v.id, v.display_name as name, v.is_demo,
        count(*) filter (where vo.status <> 'cancelled')::int as orders,
        count(*) filter (where vo.status = 'cancelled')::int as cancelled,
        coalesce(sum(vo.subtotal_pkr) filter (where vo.status <> 'cancelled'), 0)::bigint as gross,
        coalesce(sum(vo.commission_pkr) filter (where vo.status <> 'cancelled'), 0)::bigint as commission,
        count(*) filter (where vo.status <> 'cancelled' and vo.commission_pkr is null)::int as commission_pending,
        coalesce(sum(vo.net_pkr) filter (where vo.status <> 'cancelled'), 0)::bigint as net,
        (select count(*)::int from disputes x where x.vendor_order_id in (select id from vendor_orders y where y.vendor_id = v.id) and ${inRange("x.created_at")}) as disputes,
        (select avg(rating)::numeric(3,2) from reviews rv where rv.vendor_id = v.id and rv.status = 'published') as rating,
        (select count(*)::int from reviews rv where rv.vendor_id = v.id and rv.status = 'published') as reviews
      from vendor_orders vo join orders o on o.id = vo.order_id join vendors v on v.id = vo.vendor_id
      where o.paid_at is not null and ${inRange("o.paid_at")}
      group by v.id order by gross desc`),
    query<{ currency: string; status: string; n: number; amount: string; orders: number }>(sql`
      select currency, status, count(*)::int as n, sum(amount)::bigint as amount, count(distinct order_id)::int as orders
      from refunds where ${inRange("created_at")} group by currency, status`),
    query<{ status: string; n: number }>(sql`select status, count(*)::int as n from disputes where ${inRange("created_at")} group by status`),
    query<{ reason: string; n: number }>(sql`select reason, count(*)::int as n from disputes where ${inRange("created_at")} group by reason order by n desc`),
    query<{ status: string; n: number; pkr: string; paid_in_range: string }>(sql`
      select status, count(*)::int as n, sum(amount_pkr)::bigint as pkr,
        coalesce(sum(amount_pkr) filter (where status = 'paid' and ${inRange("paid_at")}), 0)::bigint as paid_in_range
      from payouts where ${inRange("created_at")} or (status = 'paid' and ${inRange("paid_at")}) group by status`),
  ]);

  const orders: ReportOrder[] = orderRows.map((o) => ({
    createdAt: new Date(o.created_at),
    paidAt: o.paid_at ? new Date(o.paid_at) : null,
    status: o.status,
    currency: o.currency,
    fx: Number(o.fx),
    destination: o.destination,
    itemsSubtotal: Number(o.items_subtotal),
    total: Number(o.total),
    discountAmount: Number(o.discount_amount),
    shippingAmount: o.shipping_amount == null ? null : Number(o.shipping_amount),
    shippingStatus: o.shipping_status,
    dutyAmount: o.duty_amount == null ? null : Number(o.duty_amount),
    dutyStatus: o.duty_status,
    importTaxAmount: o.import_tax_amount == null ? null : Number(o.import_tax_amount),
    importTaxStatus: o.import_tax_status,
    handlingAmount: o.handling_amount == null ? null : Number(o.handling_amount),
    handlingStatus: o.handling_status,
  }));
  const paidInRange = orders.filter((o) => o.paidAt && o.paidAt >= r.from && o.paidAt < r.toExclusive);
  const createdInRange = orders.filter((o) => o.createdAt >= r.from && o.createdAt < r.toExclusive);
  const valuePaid = paidInRange.filter((o) => o.status !== "refunded");
  const refundOrderCount = refundRows.filter((x) => x.status === "processed").reduce((a, x) => a + x.orders, 0);
  const disputeCount = disputeRows.reduce((a, x) => a + x.n, 0);

  return {
    range: r,
    orders: createdInRange,
    paid: paidInRange,
    months: gmvByMonth(valuePaid, r.from, r.to),
    destinations: byDestination(createdInRange.map((o) => (o.status === "refunded" ? { ...o, paidAt: null } : o))),
    landed: landedCostAverages(createdInRange.filter((o) => o.status !== "cancelled")),
    categories: categories.map((c) => ({ ...c, pkr: Number(c.pkr) })),
    artisans: artisans.map((a) => ({ ...a, gross: Number(a.gross), commission: Number(a.commission), net: Number(a.net), rating: a.rating == null ? null : Number(a.rating) })),
    refunds: refundRows.map((x) => ({ ...x, amount: Number(x.amount) })),
    disputes: disputeRows,
    disputeReasons,
    payouts: payoutRows.map((p) => ({ ...p, pkr: Number(p.pkr), paidInRange: Number(p.paid_in_range) })),
    rates: refundDisputeRates({ paidOrders: paidInRange.length, refundedOrders: refundOrderCount, disputedOrders: disputeCount }),
    gmvPkr: valuePaid.reduce((a, o) => a + Math.round(o.total * o.fx), 0),
    valuePaid,
  };
}

export type ReportData = Awaited<ReturnType<typeof reportData>>;
