import "server-only";
import { eq, gte, ilike, isNull, lt, sql, type SQL } from "drizzle-orm";
import { newsletterSubscribers } from "@/lib/db/schema";
import { dateRange, str, type SearchParams } from "./params";
import { likeTerm } from "./sql";

/** Newsletter list filters shared by the page and its CSV export. */
export function newsletterConditions(params: SearchParams): SQL[] {
  const c: SQL[] = [];
  const q = str(params, "q");
  if (q) c.push(ilike(newsletterSubscribers.email, likeTerm(q)));
  const status = str(params, "status");
  if (status) c.push(eq(newsletterSubscribers.status, status));
  const source = str(params, "source");
  if (source === "none") c.push(isNull(newsletterSubscribers.source));
  else if (source) c.push(eq(newsletterSubscribers.source, source));
  if (str(params, "buyer") === "1") c.push(sql`exists (select 1 from users u where lower(u.email) = lower("newsletter_subscribers"."email"))`);
  if (str(params, "buyer") === "0") c.push(sql`not exists (select 1 from users u where lower(u.email) = lower("newsletter_subscribers"."email"))`);
  if (str(params, "from") || str(params, "to")) {
    const r = dateRange(params, 3650);
    c.push(gte(newsletterSubscribers.createdAt, r.from), lt(newsletterSubscribers.createdAt, r.toExclusive));
  }
  return c;
}
