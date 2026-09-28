import { csvAmount, csvResponse, toCsv } from "@/lib/admin/csv";
import { listCustomers } from "@/lib/admin/customers";
import { paramsOf, staffForRoute, stamp } from "@/lib/admin/route-auth";

export async function GET(req: Request) {
  const auth = await staffForRoute("customers.view");
  if ("error" in auth) return auth.error;
  const { rows } = await listCustomers(paramsOf(req), 1, 20_000);
  const csv = toCsv(rows, [
    { header: "Name", value: (c) => c.name },
    { header: "Email", value: (c) => c.email },
    { header: "Country", value: (c) => c.country },
    { header: "Signed up", value: (c) => c.createdAt },
    { header: "Last sign-in", value: (c) => c.lastLoginAt },
    { header: "Orders placed", value: (c) => c.orders },
    { header: "Paid orders", value: (c) => c.paidOrders },
    { header: "Lifetime value by currency", value: (c) => c.currencies.map((v) => `${csvAmount(v.total)} ${v.currency}`) },
    { header: "Lifetime value PKR (at order rates)", value: (c) => csvAmount(c.valuePkr) },
    { header: "Last order", value: (c) => c.lastOrderAt },
    { header: "Wholesale", value: (c) => (c.isWholesale ? "yes" : "no") },
    { header: "Marketing opt-in", value: (c) => (c.marketingOptIn ? "yes" : "no") },
    { header: "Login", value: (c) => c.status },
    { header: "Flagged", value: (c) => (c.flagged ? "yes" : "no") },
    { header: "Demo", value: (c) => (c.isDemo ? "yes" : "no") },
  ]);
  return csvResponse(`wahbayaan-customers-${stamp()}.csv`, csv);
}
