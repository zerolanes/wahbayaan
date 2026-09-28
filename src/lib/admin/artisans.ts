import "server-only";
import { asc, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { vendors } from "@/lib/db/schema";
import { isDemoMode } from "@/lib/settings";
import { findSharedBanners, vendorIssues } from "@/lib/trust/visibility";
import { str, type SearchParams } from "./params";
import { query } from "./sql";

/**
 * Artisans with their public-visibility diagnosis and sales/listing counts.
 * The artisan table is small (hundreds of rows), so filtering happens after
 * the guard evaluation, which needs every banner to detect shared ones.
 */
export async function artisansWithStats(params: SearchParams) {
  const d = await db();
  const [rows, stats] = await Promise.all([
    d.select().from(vendors).orderBy(asc(vendors.displayName)),
    query<{ vendor_id: string; listings: number; active: number; sales_pkr: string; orders: number; rating: string | null; reviews: number }>(sql`
      select v.id as vendor_id,
        (select count(*)::int from products p where p.vendor_id = v.id) as listings,
        (select count(*)::int from products p where p.vendor_id = v.id and p.status = 'active') as active,
        coalesce((select sum(vo.subtotal_pkr) from vendor_orders vo join orders o on o.id = vo.order_id where vo.vendor_id = v.id and o.paid_at is not null and vo.status <> 'cancelled'), 0)::bigint as sales_pkr,
        (select count(*)::int from vendor_orders vo where vo.vendor_id = v.id) as orders,
        (select avg(r.rating)::numeric(3,2) from reviews r where r.vendor_id = v.id and r.status = 'published') as rating,
        (select count(*)::int from reviews r where r.vendor_id = v.id and r.status = 'published') as reviews
      from vendors v`),
  ]);
  const shared = findSharedBanners(rows);
  const ctx = { demoMode: isDemoMode() };
  const all = rows.map((v) => {
    const s = stats.find((x) => x.vendor_id === v.id);
    return {
      ...v,
      issues: vendorIssues(v, ctx, shared),
      listings: s?.listings ?? 0,
      activeListings: s?.active ?? 0,
      salesPkr: Number(s?.sales_pkr ?? 0),
      orders: s?.orders ?? 0,
      rating: s?.rating ? Number(s.rating) : null,
      reviews: s?.reviews ?? 0,
    };
  });
  const q = str(params, "q").toLowerCase();
  const filtered = all.filter((v) => {
    if (q && !`${v.displayName} ${v.slug} ${v.craft} ${v.workshopCity ?? ""}`.toLowerCase().includes(q)) return false;
    if (str(params, "status") && v.status !== str(params, "status")) return false;
    if (str(params, "craft") && v.craft !== str(params, "craft")) return false;
    if (str(params, "region") && v.workshopRegion !== str(params, "region")) return false;
    if (str(params, "demo") === "1" && !v.isDemo) return false;
    if (str(params, "demo") === "0" && v.isDemo) return false;
    if (str(params, "issues") === "1" && !v.issues.length) return false;
    if (str(params, "featured") === "1" && !v.isFeatured) return false;
    return true;
  });
  const sort = str(params, "sort");
  if (sort === "sales") filtered.sort((a, b) => b.salesPkr - a.salesPkr);
  else if (sort === "newest") filtered.sort((a, b) => +b.createdAt - +a.createdAt);
  else if (sort === "listings") filtered.sort((a, b) => b.listings - a.listings);
  return { all, filtered };
}
