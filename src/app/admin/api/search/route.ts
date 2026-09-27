import { and, desc, eq, ilike, or } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { disputes, orders, products, users, vendors } from "@/lib/db/schema";
import { likeTerm } from "@/lib/admin/sql";
import { orderMoney } from "@/lib/admin/money";

/** GET /admin/api/search?q= — records for the command palette, filtered by the caller's permissions. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "staff") return Response.json({ error: "Unauthorized" }, { status: 401 });
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return Response.json({ results: [] });
  const term = likeTerm(q);
  const d = await db();
  const has = (p: string) => user.permissions.has(p);

  const [orderRows, vendorRows, productRows, customerRows, disputeRows] = await Promise.all([
    has("orders.view")
      ? d
          .select({ number: orders.number, name: orders.customerName, total: orders.total, currency: orders.currency, status: orders.status })
          .from(orders)
          .where(or(ilike(orders.number, term), ilike(orders.email, term), ilike(orders.customerName, term)))
          .orderBy(desc(orders.createdAt))
          .limit(6)
      : [],
    has("vendors.view")
      ? d
          .select({ id: vendors.id, name: vendors.displayName, craft: vendors.craft, city: vendors.workshopCity })
          .from(vendors)
          .where(or(ilike(vendors.displayName, term), ilike(vendors.slug, term), ilike(vendors.craft, term), ilike(vendors.workshopCity, term)))
          .limit(6)
      : [],
    has("products.view")
      ? d
          .select({ id: products.id, title: products.title, status: products.status })
          .from(products)
          .where(or(ilike(products.title, term), ilike(products.slug, term)))
          .limit(6)
      : [],
    has("customers.view")
      ? d
          .select({ id: users.id, name: users.name, email: users.email })
          .from(users)
          .where(and(eq(users.role, "buyer"), or(ilike(users.name, term), ilike(users.email, term))))
          .limit(6)
      : [],
    has("disputes.view")
      ? d.select({ number: disputes.number, status: disputes.status }).from(disputes).where(ilike(disputes.number, term)).limit(4)
      : [],
  ]);

  const results = [
    ...orderRows.map((o) => ({ type: "Order", label: `${o.number} · ${o.name}`, sublabel: `${orderMoney(o.total, o.currency)} · ${o.status.replace(/_/g, " ")}`, href: `/admin/orders/${o.number}` })),
    ...disputeRows.map((x) => ({ type: "Dispute", label: x.number, sublabel: x.status.replace(/_/g, " "), href: `/admin/disputes/${x.number}` })),
    ...vendorRows.map((v) => ({ type: "Artisan", label: v.name, sublabel: [v.craft, v.city].filter(Boolean).join(" · "), href: `/admin/artisans/${v.id}` })),
    ...productRows.map((p) => ({ type: "Listing", label: p.title, sublabel: p.status.replace(/_/g, " "), href: `/admin/listings/${p.id}` })),
    ...customerRows.map((c) => ({ type: "Customer", label: c.name, sublabel: c.email, href: `/admin/customers/${c.id}` })),
  ];
  return Response.json({ results });
}
