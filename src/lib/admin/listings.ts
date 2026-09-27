import "server-only";
import { and, asc, desc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { categories, products, vendors } from "@/lib/db/schema";
import { isDemoMode } from "@/lib/settings";
import { productIssues } from "@/lib/trust/visibility";
import { str, type SearchParams } from "./params";
import { likeTerm } from "./sql";

export const LISTING_TABS = [
  { value: "", label: "All" },
  { value: "pending_review", label: "Pending review" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "rejected", label: "Rejected" },
  { value: "archived", label: "Archived" },
] as const;

export function listingConditions(params: SearchParams, opts: { includeStatus?: boolean } = {}): SQL[] {
  const c: SQL[] = [];
  const q = str(params, "q");
  if (q) c.push(or(ilike(products.title, likeTerm(q)), ilike(products.slug, likeTerm(q)), ilike(vendors.displayName, likeTerm(q)))!);
  if (str(params, "artisan")) c.push(eq(products.vendorId, str(params, "artisan")));
  if (str(params, "category")) c.push(eq(products.categoryId, str(params, "category")));
  if (str(params, "featured") === "1") c.push(eq(products.isFeatured, true));
  if (str(params, "demo") === "1") c.push(eq(products.isDemo, true));
  if (str(params, "demo") === "0") c.push(eq(products.isDemo, false));
  if (str(params, "availability")) c.push(sql`${products.availability} = ${str(params, "availability")}`);
  if (str(params, "image") === "illustration") c.push(sql`exists (select 1 from product_images i where i.product_id = ${products.id} and i.kind = 'illustration')`);
  if (str(params, "image") === "none") c.push(sql`not exists (select 1 from product_images i where i.product_id = ${products.id})`);
  if (str(params, "missing") === "shipping") c.push(or(isNull(products.weightG), isNull(products.widthCm), isNull(products.heightCm), isNull(products.depthCm))!);
  if (str(params, "missing") === "hs") c.push(and(isNull(products.hsCodeOverride), isNull(categories.hsCode))!);
  if (str(params, "wholesale") === "1") c.push(eq(products.wholesaleEnabled, true));
  if (str(params, "drop") === "1") c.push(eq(products.isLimitedDrop, true));
  if (str(params, "issues") === "1") {
    // SQL mirror of productIssues(): no images, placeholder copy, or demo rows outside demo mode.
    const re = "lorem ipsum|wah\\s*bayaan marketplace|^\\s*(test|demo|sample)([^a-z]|$)|coming soon";
    c.push(
      or(
        sql`not exists (select 1 from product_images i where i.product_id = ${products.id})`,
        sql`${products.title} ~* ${re}`,
        sql`coalesce(${products.description}, '') ~* ${re}`,
        isDemoMode() ? sql`false` : eq(products.isDemo, true),
      )!,
    );
  }
  if (opts.includeStatus !== false && str(params, "status")) c.push(sql`${products.status} = ${str(params, "status")}`);
  return c;
}

export function listingSort(params: SearchParams) {
  switch (str(params, "sort")) {
    case "price_desc":
      return [desc(products.pricePkr)];
    case "price_asc":
      return [asc(products.pricePkr)];
    case "views":
      return [desc(products.viewCount)];
    case "title":
      return [asc(products.title)];
    case "updated":
      return [desc(products.updatedAt)];
    default:
      return [desc(products.createdAt)];
  }
}

export async function listListings(params: SearchParams, page: number, pageSize: number) {
  const d = await db();
  const where = and(...listingConditions(params));
  const base = () =>
    d
      .select({
        p: products,
        vendorName: vendors.displayName,
        vendorId: vendors.id,
        category: categories.name,
        categoryHs: categories.hsCode,
        imageCount: sql<number>`(select count(*)::int from product_images i where i.product_id = ${products.id})`,
        illusCount: sql<number>`(select count(*)::int from product_images i where i.product_id = ${products.id} and i.kind = 'illustration')`,
        cover: sql<string | null>`(select url from product_images i where i.product_id = ${products.id} order by sort limit 1)`,
        coverKind: sql<string | null>`(select kind::text from product_images i where i.product_id = ${products.id} order by sort limit 1)`,
      })
      .from(products)
      .innerJoin(vendors, eq(vendors.id, products.vendorId))
      .innerJoin(categories, eq(categories.id, products.categoryId));
  const rows = await base().where(where).orderBy(...listingSort(params)).limit(pageSize).offset((page - 1) * pageSize);
  const [{ n }] = await d.select({ n: sql<number>`count(*)::int` }).from(products).innerJoin(vendors, eq(vendors.id, products.vendorId)).innerJoin(categories, eq(categories.id, products.categoryId)).where(where);
  const ctx = { demoMode: isDemoMode() };
  const out = rows.map((r) => ({ ...r, issues: productIssues({ ...r.p, imageCount: Number(r.imageCount) }, ctx) }));
  return { rows: out, total: Number(n) };
}

export async function listingCounts(params: SearchParams) {
  const d = await db();
  const rows = await d
    .select({ s: products.status, n: sql<number>`count(*)::int` })
    .from(products)
    .innerJoin(vendors, eq(vendors.id, products.vendorId))
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(and(...listingConditions(params, { includeStatus: false })))
    .groupBy(products.status);
  const m = Object.fromEntries(rows.map((r) => [r.s, Number(r.n)])) as Record<string, number>;
  m[""] = rows.reduce((a, r) => a + Number(r.n), 0);
  return m;
}
