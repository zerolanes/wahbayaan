import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { orders, payments } from "@/lib/db/schema";
import { csvAmount, csvResponse, toCsv } from "@/lib/admin/csv";
import { str } from "@/lib/admin/params";
import { paramsOf, staffForRoute, stamp } from "@/lib/admin/route-auth";

export async function GET(req: Request) {
  const auth = await staffForRoute("escrow.release");
  if ("error" in auth) return auth.error;
  const params = paramsOf(req);
  const conds: SQL[] = [];
  if (str(params, "mode")) conds.push(eq(payments.mode, str(params, "mode")));
  if (str(params, "pstatus")) conds.push(sql`${payments.status} = ${str(params, "pstatus")}`);
  const d = await db();
  const rows = await d
    .select({ p: payments, number: orders.number })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .where(and(...conds))
    .orderBy(desc(payments.createdAt))
    .limit(50_000);
  const csv = toCsv(rows, [
    { header: "Order", value: (r) => r.number },
    { header: "Created at", value: (r) => r.p.createdAt },
    { header: "Provider", value: (r) => r.p.provider },
    { header: "Mode", value: (r) => r.p.mode },
    { header: "Reference", value: (r) => r.p.providerRef },
    { header: "Currency", value: (r) => r.p.currency },
    { header: "Amount", value: (r) => csvAmount(r.p.amount) },
    { header: "Status", value: (r) => r.p.status },
  ]);
  return csvResponse(`wahbayaan-payments-${stamp()}.csv`, csv);
}
