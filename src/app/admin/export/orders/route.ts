import { and, inArray, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { orders, vendorOrders, vendors } from "@/lib/db/schema";
import { csvAmount, csvResponse, toCsv } from "@/lib/admin/csv";
import { orderConditions, orderSort } from "@/lib/admin/orders";
import { paramsOf, staffForRoute, stamp } from "@/lib/admin/route-auth";

export async function GET(req: Request) {
  const auth = await staffForRoute("orders.view");
  if ("error" in auth) return auth.error;
  const params = paramsOf(req);
  const d = await db();
  const rows = await d.select().from(orders).where(and(...orderConditions(params))).orderBy(...orderSort(params)).limit(20_000);
  const vos = rows.length
    ? await d
        .select({ orderId: vendorOrders.orderId, name: vendors.displayName })
        .from(vendorOrders)
        .innerJoin(vendors, eq(vendors.id, vendorOrders.vendorId))
        .where(inArray(vendorOrders.orderId, rows.map((r) => r.id)))
    : [];
  const csv = toCsv(rows, [
    { header: "Order", value: (o) => o.number },
    { header: "Placed at", value: (o) => o.createdAt },
    { header: "Status", value: (o) => o.status },
    { header: "Payment status", value: (o) => o.paymentStatus },
    { header: "Funds", value: (o) => o.fundsState },
    { header: "Customer", value: (o) => o.customerName },
    { header: "Email", value: (o) => o.email },
    { header: "Destination", value: (o) => o.destinationCountry },
    { header: "Currency", value: (o) => o.currency },
    { header: "Items subtotal", value: (o) => csvAmount(o.itemsSubtotal) },
    { header: "Shipping", value: (o) => (o.shippingStatus === "known" ? csvAmount(o.shippingAmount) : o.shippingStatus) },
    { header: "Duty", value: (o) => (o.dutyStatus === "known" ? csvAmount(o.dutyAmount) : o.dutyStatus) },
    { header: "Import tax", value: (o) => (o.importTaxStatus === "known" ? csvAmount(o.importTaxAmount) : o.importTaxStatus) },
    { header: "Handling", value: (o) => (o.handlingStatus === "known" ? csvAmount(o.handlingAmount) : o.handlingStatus) },
    { header: "Gift wrap", value: (o) => csvAmount(o.giftWrapAmount) },
    { header: "Discount", value: (o) => csvAmount(o.discountAmount) },
    { header: "Total", value: (o) => csvAmount(o.total) },
    { header: "Total complete", value: (o) => (o.totalComplete ? "yes" : "no") },
    { header: "FX PKR per unit", value: (o) => o.fxPkrPerUnit },
    { header: "FX source", value: (o) => o.fxSource },
    { header: "PKR equivalent", value: (o) => csvAmount(Math.round(o.total * Number(o.fxPkrPerUnit))) },
    { header: "Artisans", value: (o) => vos.filter((v) => v.orderId === o.id).map((v) => v.name) },
    { header: "Gift", value: (o) => (o.isGift ? "yes" : "no") },
    { header: "Coupon", value: (o) => o.couponCode },
    { header: "Paid at", value: (o) => o.paidAt },
    { header: "Delivered at", value: (o) => o.deliveredAt },
    { header: "Released at", value: (o) => o.releasedAt },
    { header: "Demo", value: (o) => (o.isDemo ? "yes" : "no") },
  ]);
  return csvResponse(`wahbayaan-orders-${stamp()}.csv`, csv);
}
