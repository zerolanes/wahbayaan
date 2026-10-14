import { desc, isNotNull, sql } from "drizzle-orm";
import content from "@/content/home.json";
import { db } from "@/lib/db/client";
import { orderItems } from "@/lib/db/schema";
import { featureFlags } from "@/lib/features";
import { getPublicBrandProducts, type PublicBrandProduct } from "@/lib/queries/brands";
import { getPublicCategories, getPublicProducts, type ProductCardData } from "@/lib/queries/catalog";

type Flags = Awaited<ReturnType<typeof featureFlags>>;
export type BestsellerTabDef = (typeof content.bestsellers.tabs)[number];
export type BestsellerData = { id: string; label: string; href: string; products?: ProductCardData[]; brandProducts?: PublicBrandProduct[] };

/** Product ids ranked by units ordered (real order lines only; the public guards decide what shows). */
export async function rankedByOrders(limit = 30): Promise<string[]> {
  const d = await db();
  const rows = await d
    .select({ id: orderItems.productId, units: sql<number>`sum(${orderItems.qty})::int` })
    .from(orderItems)
    .where(isNotNull(orderItems.productId))
    .groupBy(orderItems.productId)
    .orderBy(desc(sql`sum(${orderItems.qty})`))
    .limit(limit);
  return rows.map((r) => r.id!).filter(Boolean);
}

const uniq = (list: ProductCardData[]) => list.filter((p, i) => list.findIndex((q) => q.id === p.id) === i);

/** Bestseller tabs that apply right now: flag on, and craft tabs only for crafts that are public. */
export async function bestsellerTabDefs(flags: Flags): Promise<BestsellerTabDef[]> {
  const categories = await getPublicCategories();
  return content.bestsellers.tabs.filter((t) => {
    if ("flag" in t && t.flag && flags[t.flag as keyof Flags] === false) return false;
    return t.id === "all" || t.id === "brands" || categories.some((c) => c.slug === t.id);
  });
}

/**
 * One bestseller tab's pieces. "All": order-ranked first (in rank order), topped
 * up with featured, then newest. A craft: that craft's pieces, best-selling
 * first. "Pakistani brands": brand pieces in stock. Null when there is nothing to show.
 */
export async function bestsellerTab(def: BestsellerTabDef, rankedIds?: string[]): Promise<BestsellerData | null> {
  const ranked = rankedIds ?? (await rankedByOrders());
  if (def.id === "brands") {
    const items = (await getPublicBrandProducts()).filter((p) => p.inStock).slice(0, 10);
    return items.length ? { id: def.id, label: def.label, href: "/brands", brandProducts: items } : null;
  }
  if (def.id === "all") {
    const [top, featured, newest] = await Promise.all([
      ranked.length ? getPublicProducts({ ids: ranked, limit: 30 }) : Promise.resolve({ items: [] as ProductCardData[], total: 0 }),
      getPublicProducts({ featured: true, limit: 12 }),
      getPublicProducts({ sort: "newest", limit: 20 }),
    ]);
    const topSorted = ranked.map((id) => top.items.find((p) => p.id === id)).filter((p): p is ProductCardData => !!p);
    return { id: def.id, label: def.label, href: "/shop", products: uniq([...topSorted, ...featured.items, ...newest.items]).slice(0, 10) };
  }
  const rank = (p: ProductCardData) => ranked.indexOf(p.id) + 1 || 999;
  const { items } = await getPublicProducts({ categorySlug: def.id, sort: "featured", limit: 10 });
  return { id: def.id, label: def.label, href: `/category/${def.id}`, products: [...items].sort((a, b) => rank(a) - rank(b)) };
}
