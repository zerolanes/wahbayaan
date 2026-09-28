import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { products, vendors, waitlistEntries } from "@/lib/db/schema";
import { csvResponse, toCsv } from "@/lib/admin/csv";
import { str } from "@/lib/admin/params";
import { paramsOf, staffForRoute, stamp } from "@/lib/admin/route-auth";

export async function GET(req: Request) {
  const auth = await staffForRoute("requests.manage");
  if ("error" in auth) return auth.error;
  const product = str(paramsOf(req), "product");
  const d = await db();
  const rows = await d
    .select({ w: waitlistEntries, title: products.title, slug: products.slug, vendor: vendors.displayName })
    .from(waitlistEntries)
    .innerJoin(products, eq(products.id, waitlistEntries.productId))
    .innerJoin(vendors, eq(vendors.id, products.vendorId))
    .where(/^[0-9a-f-]{36}$/i.test(product) ? eq(waitlistEntries.productId, product) : undefined)
    .orderBy(desc(waitlistEntries.createdAt))
    .limit(50_000);
  const csv = toCsv(rows, [
    { header: "Piece", value: (r) => r.title },
    { header: "Slug", value: (r) => r.slug },
    { header: "Artisan", value: (r) => r.vendor },
    { header: "Email", value: (r) => r.w.email },
    { header: "Joined", value: (r) => r.w.createdAt },
    { header: "Notified", value: (r) => r.w.notifiedAt },
  ]);
  return csvResponse(`wahbayaan-waitlists-${stamp()}.csv`, csv);
}
