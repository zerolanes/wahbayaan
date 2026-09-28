import { and, desc } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { newsletterSubscribers } from "@/lib/db/schema";
import { csvResponse, toCsv } from "@/lib/admin/csv";
import { newsletterConditions } from "@/lib/admin/newsletter";
import { paramsOf, staffForRoute, stamp } from "@/lib/admin/route-auth";

export async function GET(req: Request) {
  const auth = await staffForRoute("marketing.manage");
  if ("error" in auth) return auth.error;
  const d = await db();
  const rows = await d.select().from(newsletterSubscribers).where(and(...newsletterConditions(paramsOf(req)))).orderBy(desc(newsletterSubscribers.createdAt)).limit(100_000);
  const csv = toCsv(rows, [
    { header: "Email", value: (r) => r.email },
    { header: "Status", value: (r) => r.status },
    { header: "Source", value: (r) => r.source },
    { header: "Signed up", value: (r) => r.createdAt },
  ]);
  return csvResponse(`wahbayaan-newsletter-${stamp()}.csv`, csv);
}
