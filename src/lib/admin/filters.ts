import "server-only";
import { eq, gte, ilike, lt, or, sql, type SQL } from "drizzle-orm";
import { orders, refunds } from "@/lib/db/schema";
import { dateRange, str, type SearchParams } from "./params";
import { likeTerm } from "./sql";

/** URL filters shared between admin list pages and their CSV exports. */
export function refundConditions(params: SearchParams): SQL[] {
  const c: SQL[] = [];
  if (str(params, "q")) c.push(or(ilike(orders.number, likeTerm(str(params, "q"))), ilike(refunds.reason, likeTerm(str(params, "q"))), ilike(orders.email, likeTerm(str(params, "q"))))!);
  if (str(params, "status")) c.push(sql`${refunds.status} = ${str(params, "status")}`);
  if (str(params, "currency")) c.push(eq(refunds.currency, str(params, "currency")));
  if (str(params, "from") || str(params, "to")) {
    const r = dateRange(params, 3650);
    c.push(gte(refunds.createdAt, r.from), lt(refunds.createdAt, r.toExclusive));
  }
  return c;
}

