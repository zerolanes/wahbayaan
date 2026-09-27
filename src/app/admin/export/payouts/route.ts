import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { payouts, vendors } from "@/lib/db/schema";
import { csvAmount, csvResponse, toCsv } from "@/lib/admin/csv";
import { str } from "@/lib/admin/params";
import { paramsOf, staffForRoute, stamp } from "@/lib/admin/route-auth";

/**
 * Bank-upload CSV of payouts to send (pending + scheduled by default). Only the
 * last four digits of each account are stored, so staff complete the account
 * numbers from the artisan's verified bank letter.
 */
export async function GET(req: Request) {
  const auth = await staffForRoute("payouts.view");
  if ("error" in auth) return auth.error;
  const params = paramsOf(req);
  const statuses = str(params, "status") === "paid" ? (["paid"] as const) : (["pending", "scheduled"] as const);
  const d = await db();
  const rows = await d
    .select({ p: payouts, v: vendors })
    .from(payouts)
    .innerJoin(vendors, eq(vendors.id, payouts.vendorId))
    .where(inArray(payouts.status, [...statuses]))
    .orderBy(asc(vendors.displayName));
  return csvResponse(
    `wahbayaan-payouts-${statuses.join("-")}-${stamp()}.csv`,
    toCsv(rows, [
      { header: "Payout ID", value: (r) => r.p.id },
      { header: "Artisan", value: (r) => r.v.displayName },
      { header: "Account title", value: (r) => r.v.payoutAccountTitle },
      { header: "Bank", value: (r) => r.v.payoutBankName },
      { header: "Account (last 4)", value: (r) => r.v.payoutAccountLast4 },
      { header: "Method", value: (r) => r.v.payoutMethod },
      { header: "Amount PKR", value: (r) => csvAmount(r.p.amountPkr) },
      { header: "Status", value: (r) => r.p.status },
      { header: "Batch / reference", value: (r) => r.p.reference },
      { header: "Notes", value: (r) => r.p.notes },
      { header: "Created at", value: (r) => r.p.createdAt },
      { header: "Paid at", value: (r) => r.p.paidAt },
    ]),
  );
}
