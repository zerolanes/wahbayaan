import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { loyaltyLedger, orders, users } from "@/lib/db/schema";
import { csvResponse, toCsv } from "@/lib/admin/csv";
import { staffForRoute, stamp } from "@/lib/admin/route-auth";

export async function GET() {
  const auth = await staffForRoute("marketing.manage");
  if ("error" in auth) return auth.error;
  const d = await db();
  const rows = await d
    .select({ l: loyaltyLedger, name: users.name, email: users.email, order: orders.number })
    .from(loyaltyLedger)
    .innerJoin(users, eq(users.id, loyaltyLedger.userId))
    .leftJoin(orders, eq(orders.id, loyaltyLedger.orderId))
    .orderBy(desc(loyaltyLedger.createdAt))
    .limit(50_000);
  const csv = toCsv(rows, [
    { header: "When", value: (r) => r.l.createdAt },
    { header: "Customer", value: (r) => r.name },
    { header: "Email", value: (r) => r.email },
    { header: "Points", value: (r) => r.l.points },
    { header: "Reason", value: (r) => r.l.reason },
    { header: "Order", value: (r) => r.order },
  ]);
  return csvResponse(`wahbayaan-loyalty-ledger-${stamp()}.csv`, csv);
}
