import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { orders, refunds } from "@/lib/db/schema";
import { csvAmount, csvResponse, toCsv } from "@/lib/admin/csv";
import { refundConditions } from "@/lib/admin/filters";
import { paramsOf, staffForRoute, stamp } from "@/lib/admin/route-auth";

export async function GET(req: Request) {
  const auth = await staffForRoute("orders.refund");
  if ("error" in auth) return auth.error;
  const d = await db();
  const rows = await d
    .select({ r: refunds, number: orders.number, email: orders.email })
    .from(refunds)
    .innerJoin(orders, eq(orders.id, refunds.orderId))
    .where(and(...refundConditions(paramsOf(req))))
    .orderBy(desc(refunds.createdAt))
    .limit(50_000);
  return csvResponse(
    `wahbayaan-refunds-${stamp()}.csv`,
    toCsv(rows, [
      { header: "Order", value: (x) => x.number },
      { header: "Buyer email", value: (x) => x.email },
      { header: "Currency", value: (x) => x.r.currency },
      { header: "Amount", value: (x) => csvAmount(x.r.amount) },
      { header: "Reason", value: (x) => x.r.reason },
      { header: "Status", value: (x) => x.r.status },
      { header: "Created at", value: (x) => x.r.createdAt },
      { header: "Processed at", value: (x) => x.r.processedAt },
    ]),
  );
}
