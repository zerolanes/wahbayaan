import "server-only";
import { cache } from "react";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { categories, productImages, products, reviewPhotos, reviews, vendors } from "@/lib/db/schema";
import { isDemoMode } from "@/lib/settings";
import {
  findSharedBanners,
  isCategoryPublic,
  isProductPublic,
  isVendorPublic,
  type VisibilityContext,
} from "@/lib/trust/visibility";
import { convertToPkr, type FxQuote } from "@/lib/money/currency";

export function visibilityContext(): VisibilityContext {
  return { demoMode: isDemoMode() };
}

// ── Categories ──────────────────────────────────────────────────────────────

export type PublicCategory = typeof categories.$inferSelect & { productCount: number };

export const getPublicCategories = cache(async (): Promise<PublicCategory[]> => {
  const d = await db();
  const [rows, counts, publicVendorIds] = await Promise.all([
    d.select().from(categories).orderBy(asc(categories.sort), asc(categories.name)),
    d
      .select({ categoryId: products.categoryId, vendorId: products.vendorId, n: sql<number>`count(*)::int` })
      .from(products)
      .where(eq(products.status, "active"))
      .groupBy(products.categoryId, products.vendorId),
    getPublicVendorIds(),
  ]);
  const ctx = visibilityContext();
  return rows
    .filter((c) => isCategoryPublic(c, ctx))
    .map((c) => ({
      ...c,
      productCount: counts
        .filter((r) => r.categoryId === c.id && publicVendorIds.has(r.vendorId))
        .reduce((a, r) => a + r.n, 0),
    }));
});

export async function getPublicCategory(slug: string) {
  return (await getPublicCategories()).find((c) => c.slug === slug) ?? null;
}

// ── Artisans ────────────────────────────────────────────────────────────────

export const getPublicVendorIds = cache(async (): Promise<Set<string>> => {
  const d = await db();
  const rows = await d
    .select({
      id: vendors.id,
      displayName: vendors.displayName,
      status: vendors.status,
      profilePhotoUrl: vendors.profilePhotoUrl,
      bannerUrl: vendors.bannerUrl,
      story: vendors.story,
      workshopCity: vendors.workshopCity,
      isDemo: vendors.isDemo,
      vacationMode: vendors.vacationMode,
    })
    .from(vendors);
  const shared = findSharedBanners(rows);
  const ctx = visibilityContext();
  return new Set(rows.filter((v) => isVendorPublic(v, ctx, shared)).map((v) => v.id));
});

export type RatingSummary = { average: number | null; count: number };

export const getVendorRatings = cache(async (): Promise<Map<string, RatingSummary>> => {
  const d = await db();
  const rows = await d
    .select({ vendorId: reviews.vendorId, avg: sql<string>`avg(${reviews.rating})`, n: sql<number>`count(*)::int` })
    .from(reviews)
    .where(eq(reviews.status, "published"))
    .groupBy(reviews.vendorId);
  return new Map(rows.map((r) => [r.vendorId, { average: r.n ? Number(r.avg) : null, count: r.n }]));
});

export const getProductRatings = cache(async (): Promise<Map<string, RatingSummary>> => {
  const d = await db();
  const rows = await d
    .select({ productId: reviews.productId, avg: sql<string>`avg(${reviews.rating})`, n: sql<number>`count(*)::int` })
    .from(reviews)
    .where(eq(reviews.status, "published"))
    .groupBy(reviews.productId);
  return new Map(rows.map((r) => [r.productId, { average: r.n ? Number(r.avg) : null, count: r.n }]));
});

export type PublicVendor = typeof vendors.$inferSelect & {
  rating: RatingSummary;
  productCount: number;
  salesCount: number;
  categoryName: string | null;
};

export const getPublicVendors = cache(async (): Promise<PublicVendor[]> => {
  const d = await db();
  const ids = [...(await getPublicVendorIds())];
  if (!ids.length) return [];
  const [rows, ratings, productCounts, sales] = await Promise.all([
    d
      .select({ vendor: vendors, categoryName: categories.name })
      .from(vendors)
      .leftJoin(categories, eq(categories.id, vendors.primaryCategoryId))
      .where(inArray(vendors.id, ids))
      .orderBy(desc(vendors.isFeatured), asc(vendors.displayName)),
    getVendorRatings(),
    d
      .select({ vendorId: products.vendorId, n: sql<number>`count(*)::int` })
      .from(products)
      .where(and(eq(products.status, "active"), inArray(products.vendorId, ids)))
      .groupBy(products.vendorId),
    getVendorSalesCounts(),
  ]);
  return rows.map(({ vendor, categoryName }) => ({
    ...vendor,
    categoryName,
    rating: ratings.get(vendor.id) ?? { average: null, count: 0 },
    productCount: productCounts.find((p) => p.vendorId === vendor.id)?.n ?? 0,
    salesCount: sales.get(vendor.id) ?? 0,
  }));
});

/** Completed or delivered vendor orders per artisan — the "total sales" trust signal. */
export const getVendorSalesCounts = cache(async (): Promise<Map<string, number>> => {
  const d = await db();
  const rows = await d.execute<{ vendor_id: string; n: number }>(
    sql`select vendor_id, count(*)::int as n from vendor_orders where status in ('shipped','delivered') group by vendor_id`,
  );
  const list = Array.isArray(rows) ? rows : ((rows as { rows?: unknown[] }).rows ?? []);
  return new Map((list as { vendor_id: string; n: number }[]).map((r) => [r.vendor_id, Number(r.n)]));
});

export async function getPublicVendor(slug: string) {
  return (await getPublicVendors()).find((v) => v.slug === slug) ?? null;
}

// ── Products ────────────────────────────────────────────────────────────────

export type ProductCardData = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  pricePkr: number;
  compareAtPricePkr: number | null;
  availability: "ready_to_ship" | "made_to_order";
  timeToMakeDays: number | null;
  isOneOfAKind: boolean;
  isLimitedDrop: boolean;
  dropStartsAt: Date | null;
  stockQty: number;
  region: string | null;
  materials: string[];
  imageUrl: string;
  imageAlt: string | null;
  imageKind: "photo" | "illustration";
  secondImageUrl: string | null;
  vendorId: string;
  vendorName: string;
  vendorSlug: string;
  vendorVerified: boolean;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  rating: RatingSummary;
  createdAt: Date;
  isFeatured: boolean;
};

export type ProductSort = "featured" | "newest" | "price_asc" | "price_desc" | "rating";

export type ProductFilters = {
  categorySlug?: string;
  vendorId?: string;
  region?: string;
  material?: string;
  availability?: "ready_to_ship" | "made_to_order";
  /** Price band in the buyer's currency, converted to PKR with `fx`. */
  minPrice?: number;
  maxPrice?: number;
  fx?: FxQuote | null;
  q?: string;
  ids?: string[];
  featured?: boolean;
  limitedDrops?: boolean;
  customizable?: boolean;
  sort?: ProductSort;
  limit?: number;
  offset?: number;
  excludeId?: string;
};

export async function getPublicProducts(filters: ProductFilters = {}): Promise<{ items: ProductCardData[]; total: number }> {
  const d = await db();
  const vendorIds = [...(await getPublicVendorIds())];
  if (!vendorIds.length) return { items: [], total: 0 };
  const categoryList = await getPublicCategories();
  const categoryIds = categoryList.map((c) => c.id);
  if (!categoryIds.length) return { items: [], total: 0 };

  const where: SQL[] = [
    eq(products.status, "active"),
    inArray(products.vendorId, vendorIds),
    inArray(products.categoryId, categoryIds),
    sql`exists (select 1 from ${productImages} where ${productImages.productId} = ${products.id})`,
  ];
  if (!isDemoMode()) where.push(eq(products.isDemo, false));
  if (filters.categorySlug) {
    const cat = categoryList.find((c) => c.slug === filters.categorySlug);
    if (!cat) return { items: [], total: 0 };
    where.push(eq(products.categoryId, cat.id));
  }
  if (filters.vendorId) where.push(eq(products.vendorId, filters.vendorId));
  if (filters.region) where.push(sql`${products.region} = ${filters.region}`);
  if (filters.material) where.push(sql`${products.materials} ? ${filters.material}`);
  if (filters.availability) where.push(eq(products.availability, filters.availability));
  if (filters.featured) where.push(eq(products.isFeatured, true));
  if (filters.limitedDrops) where.push(eq(products.isLimitedDrop, true));
  if (filters.customizable) where.push(eq(products.customizable, true));
  if (filters.ids) where.push(filters.ids.length ? inArray(products.id, filters.ids) : sql`false`);
  if (filters.excludeId) where.push(sql`${products.id} <> ${filters.excludeId}`);
  if (filters.fx && filters.minPrice != null) where.push(sql`${products.pricePkr} >= ${convertToPkr(filters.minPrice, filters.fx)}`);
  if (filters.fx && filters.maxPrice != null) where.push(sql`${products.pricePkr} <= ${convertToPkr(filters.maxPrice, filters.fx)}`);
  if (filters.q?.trim()) {
    const q = `%${filters.q.trim()}%`;
    where.push(
      or(
        ilike(products.title, q),
        ilike(products.summary, q),
        ilike(products.description, q),
        ilike(vendors.displayName, q),
        ilike(categories.name, q),
        sql`${products.materials}::text ilike ${q}`,
      )!,
    );
  }

  const ratingAvg = sql<number>`coalesce((select avg(${reviews.rating}) from ${reviews} where ${reviews.productId} = ${products.id} and ${reviews.status} = 'published'), 0)`;
  const order = (() => {
    switch (filters.sort) {
      case "newest":
        return [desc(products.publishedAt), desc(products.createdAt)];
      case "price_asc":
        return [asc(products.pricePkr)];
      case "price_desc":
        return [desc(products.pricePkr)];
      case "rating":
        return [desc(ratingAvg), desc(products.createdAt)];
      default:
        return [desc(products.isFeatured), desc(products.publishedAt), asc(products.title)];
    }
  })();

  const whereClause = and(...where);
  const [rows, totalRows, ratings] = await Promise.all([
    d
      .select({
        p: products,
        vendorName: vendors.displayName,
        vendorSlug: vendors.slug,
        vendorStatus: vendors.status,
        categoryName: categories.name,
        categorySlug: categories.slug,
      })
      .from(products)
      .innerJoin(vendors, eq(vendors.id, products.vendorId))
      .innerJoin(categories, eq(categories.id, products.categoryId))
      .where(whereClause)
      .orderBy(...order)
      .limit(filters.limit ?? 48)
      .offset(filters.offset ?? 0),
    d
      .select({ n: sql<number>`count(*)::int` })
      .from(products)
      .innerJoin(vendors, eq(vendors.id, products.vendorId))
      .innerJoin(categories, eq(categories.id, products.categoryId))
      .where(whereClause),
    getProductRatings(),
  ]);

  const images = rows.length
    ? await d
        .select()
        .from(productImages)
        .where(inArray(productImages.productId, rows.map((r) => r.p.id)))
        .orderBy(asc(productImages.sort))
    : [];

  const items: ProductCardData[] = rows.map(({ p, ...r }) => {
    const imgs = images.filter((i) => i.productId === p.id);
    return {
      id: p.id,
      slug: p.slug,
      title: p.title,
      summary: p.summary,
      pricePkr: p.pricePkr,
      compareAtPricePkr: p.compareAtPricePkr,
      availability: p.availability,
      timeToMakeDays: p.timeToMakeDays,
      isOneOfAKind: p.isOneOfAKind,
      isLimitedDrop: p.isLimitedDrop,
      dropStartsAt: p.dropStartsAt,
      stockQty: p.stockQty,
      region: p.region,
      materials: p.materials,
      imageUrl: imgs[0].url,
      imageAlt: imgs[0].alt,
      imageKind: imgs[0].kind,
      secondImageUrl: imgs[1]?.url ?? null,
      vendorId: p.vendorId,
      vendorName: r.vendorName,
      vendorSlug: r.vendorSlug,
      vendorVerified: r.vendorStatus === "verified",
      categoryId: p.categoryId,
      categoryName: r.categoryName,
      categorySlug: r.categorySlug,
      rating: ratings.get(p.id) ?? { average: null, count: 0 },
      createdAt: p.createdAt,
      isFeatured: p.isFeatured,
    };
  });
  return { items, total: totalRows[0]?.n ?? 0 };
}

/** Distinct materials and regions among public listings, for filter menus. */
export const getFacets = cache(async (categorySlug?: string) => {
  const { items } = await getPublicProducts({ categorySlug, limit: 1000 });
  const materials = new Map<string, number>();
  const regions = new Map<string, number>();
  for (const p of items) {
    for (const m of p.materials) materials.set(m, (materials.get(m) ?? 0) + 1);
    if (p.region) regions.set(p.region, (regions.get(p.region) ?? 0) + 1);
  }
  const sortEntries = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1]).map(([value, count]) => ({ value, count }));
  return {
    materials: sortEntries(materials),
    regions: sortEntries(regions),
    readyToShip: items.filter((p) => p.availability === "ready_to_ship").length,
    madeToOrder: items.filter((p) => p.availability === "made_to_order").length,
  };
});

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProductDetail>>>;

export async function getProductDetail(slug: string) {
  const d = await db();
  const product = await d.query.products.findFirst({
    where: eq(products.slug, slug),
    with: {
      images: { orderBy: asc(productImages.sort) },
      vendor: true,
      category: true,
    },
  });
  if (!product) return null;
  const [publicVendorIds, publicCategories] = await Promise.all([getPublicVendorIds(), getPublicCategories()]);
  const ctx = visibilityContext();
  if (
    !publicVendorIds.has(product.vendorId) ||
    !publicCategories.some((c) => c.id === product.categoryId) ||
    !isProductPublic({ ...product, imageCount: product.images.length }, ctx)
  ) {
    return null;
  }

  const productReviews = await d.query.reviews.findMany({
    where: and(eq(reviews.productId, product.id), eq(reviews.status, "published")),
    with: { photos: true },
    orderBy: desc(reviews.createdAt),
  });
  const vendorRating = (await getVendorRatings()).get(product.vendorId) ?? { average: null, count: 0 };
  const salesCount = (await getVendorSalesCounts()).get(product.vendorId) ?? 0;
  const rating: RatingSummary = productReviews.length
    ? { average: productReviews.reduce((a, r) => a + r.rating, 0) / productReviews.length, count: productReviews.length }
    : { average: null, count: 0 };
  const histogram = [5, 4, 3, 2, 1].map((stars) => ({ stars, count: productReviews.filter((r) => r.rating === stars).length }));

  return { ...product, reviews: productReviews, rating, histogram, vendorRating, vendorSalesCount: salesCount };
}

export async function getReviewPhotoWall(vendorId?: string, limit = 12) {
  const d = await db();
  const where = [eq(reviews.status, "published")];
  if (vendorId) where.push(eq(reviews.vendorId, vendorId));
  return d
    .select({ url: reviewPhotos.url, reviewId: reviews.id, authorName: reviews.authorName, country: reviews.buyerCountry, rating: reviews.rating })
    .from(reviewPhotos)
    .innerJoin(reviews, eq(reviews.id, reviewPhotos.reviewId))
    .where(and(...where))
    .orderBy(desc(reviews.createdAt))
    .limit(limit);
}
