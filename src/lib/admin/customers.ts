import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { adminNotes, orders, users } from "@/lib/db/schema";
import { dateRange, str, type SearchParams } from "./params";
import { likeTerm } from "./sql";

/**
 * Buyers (users with role `buyer`). A "flag" is an admin note on the
 * `customer_flag` entity: flagged while at least one exists (the note body is
 * the reason), cleared by deleting them.
 */
export const CUSTOMER_FLAG_ENTITY = "customer_flag";

/** Paid orders that count towards value (refunded orders are excluded). */
const VALUE_ORDER = sql`o.paid_at is not null and o.status <> 'refunded'`;

// Qualified explicitly: inside a subquery drizzle would render `${users.id}` as a bare "id".
const UID = sql.raw(`"users"."id"`);
const orderCount = sql<number>`(select count(*)::int from orders o where o.user_id = ${UID})`;
const paidCount = sql<number>`(select count(*)::int from orders o where o.user_id = ${UID} and ${VALUE_ORDER})`;
const valuePkr = sql<number>`(select coalesce(sum(round(o.total * o.fx_pkr_per_unit)), 0)::bigint from orders o where o.user_id = ${UID} and ${VALUE_ORDER})`;
const lastOrderAt = sql<Date | null>`(select max(o.created_at) from orders o where o.user_id = ${UID})`;
const flagged = sql<boolean>`exists (select 1 from admin_notes n where n.entity = ${CUSTOMER_FLAG_ENTITY} and n.entity_id = ${UID}::text)`;

export const CUSTOMER_SORTS = [
  { value: "newest", label: "Newest sign-ups" },
  { value: "oldest", label: "Oldest sign-ups" },
  { value: "value", label: "Lifetime value (PKR)" },
  { value: "orders", label: "Most orders" },
  { value: "recent", label: "Most recent order" },
] as const;

export function customerConditions(params: SearchParams): SQL[] {
  const c: SQL[] = [eq(users.role, "buyer")];
  const q = str(params, "q");
  if (q) c.push(or(ilike(users.name, likeTerm(q)), ilike(users.email, likeTerm(q)), ilike(users.phone, likeTerm(q)))!);
  const country = str(params, "country");
  if (country === "none") c.push(sql`${users.country} is null`);
  else if (country) c.push(eq(users.country, country));
  const wholesale = str(params, "wholesale");
  if (wholesale === "1") c.push(eq(users.isWholesale, true));
  if (wholesale === "0") c.push(eq(users.isWholesale, false));
  const ordersFilter = str(params, "orders");
  if (ordersFilter === "none") c.push(sql`${orderCount} = 0`);
  if (ordersFilter === "any") c.push(sql`${orderCount} > 0`);
  if (ordersFilter === "paid") c.push(sql`${paidCount} > 0`);
  if (ordersFilter === "repeat") c.push(sql`${paidCount} > 1`);
  const status = str(params, "status");
  if (status === "active" || status === "suspended") c.push(eq(users.status, status));
  if (str(params, "flagged") === "1") c.push(flagged);
  if (str(params, "marketing") === "1") c.push(eq(users.marketingOptIn, true));
  if (str(params, "demo") === "0") c.push(eq(users.isDemo, false));
  if (str(params, "from") || str(params, "to")) {
    const r = dateRange(params, 3650);
    c.push(gte(users.createdAt, r.from), lt(users.createdAt, r.toExclusive));
  }
  return c;
}

export function customerSort(params: SearchParams) {
  switch (str(params, "sort")) {
    case "oldest":
      return [asc(users.createdAt)];
    case "value":
      return [sql`${valuePkr} desc`, desc(users.createdAt)];
    case "orders":
      return [sql`${orderCount} desc`, desc(users.createdAt)];
    case "recent":
      return [sql`${lastOrderAt} desc nulls last`, desc(users.createdAt)];
    default:
      return [desc(users.createdAt)];
  }
}

export async function listCustomers(params: SearchParams, page: number, pageSize: number) {
  const d = await db();
  const where = and(...customerConditions(params));
  const [rows, [{ n }]] = await Promise.all([
    d
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        country: users.country,
        preferredCurrency: users.preferredCurrency,
        status: users.status,
        isWholesale: users.isWholesale,
        marketingOptIn: users.marketingOptIn,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        isDemo: users.isDemo,
        orders: orderCount,
        paidOrders: paidCount,
        valuePkr,
        lastOrderAt,
        flagged,
      })
      .from(users)
      .where(where)
      .orderBy(...customerSort(params))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    d.select({ n: sql<number>`count(*)::int` }).from(users).where(where),
  ]);
  const byCurrency = await valueByCurrency(rows.map((r) => r.id));
  return {
    rows: rows.map((r) => ({ ...r, valuePkr: Number(r.valuePkr), orders: Number(r.orders), paidOrders: Number(r.paidOrders), lastOrderAt: r.lastOrderAt ? new Date(r.lastOrderAt) : null, currencies: byCurrency.get(r.id) ?? [] })),
    total: Number(n),
  };
}

/** Paid order value per user and buyer currency (largest first). */
export async function valueByCurrency(userIds: string[]) {
  const out = new Map<string, { currency: string; total: number; pkr: number }[]>();
  if (!userIds.length) return out;
  const d = await db();
  const rows = await d
    .select({
      userId: orders.userId,
      currency: orders.currency,
      total: sql<number>`sum(${orders.total})::bigint`,
      pkr: sql<number>`sum(round(${orders.total} * ${orders.fxPkrPerUnit}))::bigint`,
    })
    .from(orders)
    .where(and(inArray(orders.userId, userIds), sql`${orders.paidAt} is not null`, sql`${orders.status} <> 'refunded'`))
    .groupBy(orders.userId, orders.currency);
  for (const r of rows) {
    if (!r.userId) continue;
    out.set(r.userId, [...(out.get(r.userId) ?? []), { currency: r.currency, total: Number(r.total), pkr: Number(r.pkr) }].sort((a, b) => b.pkr - a.pkr));
  }
  return out;
}

export async function customerFlags(userId: string) {
  const d = await db();
  return d
    .select()
    .from(adminNotes)
    .where(and(eq(adminNotes.entity, CUSTOMER_FLAG_ENTITY), eq(adminNotes.entityId, userId)))
    .orderBy(desc(adminNotes.createdAt));
}

export async function customerStats() {
  const d = await db();
  const [row] = await d
    .select({
      total: sql<number>`count(*)::int`,
      new30: sql<number>`count(*) filter (where ${users.createdAt} >= now() - interval '30 days')::int`,
      buyers: sql<number>`count(*) filter (where ${paidCount} > 0)::int`,
      repeat: sql<number>`count(*) filter (where ${paidCount} > 1)::int`,
      wholesale: sql<number>`count(*) filter (where ${users.isWholesale})::int`,
      suspended: sql<number>`count(*) filter (where ${users.status} = 'suspended')::int`,
      flagged: sql<number>`count(*) filter (where ${flagged})::int`,
      valuePkr: sql<number>`coalesce(sum(${valuePkr}), 0)::bigint`,
    })
    .from(users)
    .where(eq(users.role, "buyer"));
  return { ...row, valuePkr: Number(row.valuePkr) };
}
