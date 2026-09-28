/**
 * Pure aggregation helpers for Admin → Reports and customer lifetime value.
 *
 * Buyer amounts stay in the order's own currency; every cross-currency total
 * is converted to PKR at the rate recorded on each order (`fx`), never at
 * today's rate. Cost lines that are `pending` are counted, never averaged as 0.
 */

export type LineStatus = "known" | "pending" | "not_applicable";

export type ReportOrder = {
  createdAt: Date;
  paidAt: Date | null;
  status: string;
  currency: string;
  /** PKR per unit of `currency`, as recorded on the order. */
  fx: number;
  destination: string;
  itemsSubtotal: number;
  total: number;
  discountAmount: number;
  shippingAmount: number | null;
  shippingStatus: LineStatus;
  dutyAmount: number | null;
  dutyStatus: LineStatus;
  importTaxAmount: number | null;
  importTaxStatus: LineStatus;
  handlingAmount: number | null;
  handlingStatus: LineStatus;
};

/** Minor units in a buyer currency → PKR minor units at the order's rate. */
export function toPkr(minor: number, fx: number): number {
  return Math.round(minor * fx);
}

/** PKR minor units → a buyer currency at a given PKR-per-unit rate. */
export function fromPkr(pkrMinor: number, pkrPerUnit: number): number | null {
  return pkrPerUnit > 0 ? Math.round(pkrMinor / pkrPerUnit) : null;
}

export function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

/** Every UTC month touched by [from, to], e.g. ["2026-07", "2026-08"]. */
export function monthKeys(from: Date, to: Date): string[] {
  const out: string[] = [];
  let y = from.getUTCFullYear();
  let m = from.getUTCMonth();
  const endY = to.getUTCFullYear();
  const endM = to.getUTCMonth();
  while (y < endY || (y === endY && m <= endM)) {
    out.push(`${y}-${String(m + 1).padStart(2, "0")}`);
    m++;
    if (m === 12) [y, m] = [y + 1, 0];
    if (out.length > 240) break;
  }
  return out;
}

export function monthLabel(key: string): string {
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }).format(new Date(`${key}-01T00:00:00Z`));
}

export type GmvMonth = { key: string; label: string; orders: number; pkr: number; byCurrency: Record<string, number> };

/** Paid GMV per month (by payment date): order count, PKR total and per-currency totals. */
export function gmvByMonth(orders: readonly ReportOrder[], from: Date, to: Date): GmvMonth[] {
  const months = new Map<string, GmvMonth>(monthKeys(from, to).map((k) => [k, { key: k, label: monthLabel(k), orders: 0, pkr: 0, byCurrency: {} }]));
  for (const o of orders) {
    if (!o.paidAt) continue;
    const m = months.get(monthKey(o.paidAt));
    if (!m) continue;
    m.orders++;
    m.pkr += toPkr(o.total, o.fx);
    m.byCurrency[o.currency] = (m.byCurrency[o.currency] ?? 0) + o.total;
  }
  return [...months.values()];
}

export type DestinationRow = { country: string; orders: number; paid: number; pkr: number; currencies: Record<string, number> };

export function byDestination(orders: readonly ReportOrder[]): DestinationRow[] {
  const map = new Map<string, DestinationRow>();
  for (const o of orders) {
    const r = map.get(o.destination) ?? { country: o.destination, orders: 0, paid: 0, pkr: 0, currencies: {} };
    r.orders++;
    if (o.paidAt) {
      r.paid++;
      r.pkr += toPkr(o.total, o.fx);
      r.currencies[o.currency] = (r.currencies[o.currency] ?? 0) + o.total;
    }
    map.set(o.destination, r);
  }
  return [...map.values()].sort((a, b) => b.pkr - a.pkr || b.orders - a.orders);
}

export const LANDED_COMPONENTS = [
  { key: "shipping", label: "International shipping" },
  { key: "duty", label: "Import duty" },
  { key: "importTax", label: "Import tax / VAT" },
  { key: "handling", label: "Handling" },
] as const;
export type LandedKey = (typeof LANDED_COMPONENTS)[number]["key"];

export type ComponentStats = {
  key: LandedKey;
  label: string;
  known: number;
  pending: number;
  notApplicable: number;
  /** Mean of known amounts in this currency, or null when none are known. */
  average: number | null;
  /** Mean share of the items subtotal across known lines (0.12 = 12%). */
  shareOfItems: number | null;
};

function component(o: ReportOrder, key: LandedKey): { amount: number | null; status: LineStatus } {
  switch (key) {
    case "shipping":
      return { amount: o.shippingAmount, status: o.shippingStatus };
    case "duty":
      return { amount: o.dutyAmount, status: o.dutyStatus };
    case "importTax":
      return { amount: o.importTaxAmount, status: o.importTaxStatus };
    case "handling":
      return { amount: o.handlingAmount, status: o.handlingStatus };
  }
}

/** Average landed-cost components per buyer currency. Pending lines are counted separately, never as zero. */
export function landedCostAverages(orders: readonly ReportOrder[]) {
  const byCurrency = new Map<string, ReportOrder[]>();
  for (const o of orders) byCurrency.set(o.currency, [...(byCurrency.get(o.currency) ?? []), o]);
  return [...byCurrency.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([currency, rows]) => ({
      currency,
      orders: rows.length,
      averageItems: Math.round(rows.reduce((a, o) => a + o.itemsSubtotal, 0) / rows.length),
      components: LANDED_COMPONENTS.map(({ key, label }): ComponentStats => {
        let known = 0,
          pending = 0,
          na = 0,
          sum = 0,
          shareSum = 0,
          shareN = 0;
        for (const o of rows) {
          const c = component(o, key);
          if (c.status === "pending" || (c.status === "known" && c.amount == null)) pending++;
          else if (c.status === "not_applicable") na++;
          else {
            known++;
            sum += c.amount!;
            if (o.itemsSubtotal > 0) {
              shareSum += c.amount! / o.itemsSubtotal;
              shareN++;
            }
          }
        }
        return { key, label, known, pending, notApplicable: na, average: known ? Math.round(sum / known) : null, shareOfItems: shareN ? shareSum / shareN : null };
      }),
    }));
}

/** Refund and dispute rates over paid orders. */
export function refundDisputeRates(input: { paidOrders: number; refundedOrders: number; disputedOrders: number }) {
  const rate = (n: number) => (input.paidOrders > 0 ? n / input.paidOrders : null);
  return { refundRate: rate(input.refundedOrders), disputeRate: rate(input.disputedOrders) };
}

export type LtvOrder = { currency: string; total: number; fx: number; paidAt: Date | null; status: string };

/**
 * Customer lifetime value: paid, non-refunded orders, summed per currency and
 * in PKR at each order's recorded rate.
 */
export function lifetimeValue(orders: readonly LtvOrder[], refundedByCurrency: Record<string, number> = {}) {
  const counted = orders.filter((o) => o.paidAt && o.status !== "refunded");
  const byCurrency = new Map<string, { total: number; pkr: number; orders: number }>();
  for (const o of counted) {
    const r = byCurrency.get(o.currency) ?? { total: 0, pkr: 0, orders: 0 };
    r.total += o.total;
    r.pkr += toPkr(o.total, o.fx);
    r.orders++;
    byCurrency.set(o.currency, r);
  }
  for (const [cur, refunded] of Object.entries(refundedByCurrency)) {
    const r = byCurrency.get(cur);
    if (!r || !refunded) continue;
    const avgFx = r.total ? r.pkr / r.total : 0;
    r.total -= refunded;
    r.pkr -= Math.round(refunded * avgFx);
  }
  const rows = [...byCurrency.entries()].map(([currency, r]) => ({ currency, ...r })).sort((a, b) => b.pkr - a.pkr);
  const pkr = rows.reduce((a, r) => a + r.pkr, 0);
  const paidOrders = counted.length;
  return { byCurrency: rows, pkr, paidOrders, averagePkr: paidOrders ? Math.round(pkr / paidOrders) : null, primaryCurrency: rows[0]?.currency ?? null };
}
