import type { MetadataRoute } from "next";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { journalPosts, pages } from "@/lib/db/schema";
import { featureFlags } from "@/lib/features";
import { getPublicBrandProducts, getPublicBrands } from "@/lib/queries/brands";
import { getPublicCategories, getPublicProducts, getPublicVendors } from "@/lib/queries/catalog";
import { isDemoMode } from "@/lib/settings";
import { journalPostLive } from "@/lib/queries/storefront";
import { siteUrl } from "@/lib/seo";

/**
 * Public pages only. Admin, seller, brand portal, account, cart, checkout,
 * search and compare are never listed (robots.ts disallows them too); pages
 * of switched-off features drop out.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const d = await db();
  const flags = await featureFlags();
  const [categories, vendors, products, posts, brands, brandProducts] = await Promise.all([
    getPublicCategories(),
    getPublicVendors(),
    getPublicProducts({ limit: 5000 }),
    flags.journal ? d.select().from(journalPosts).where(and(journalPostLive(), ...(isDemoMode() ? [] : [eq(journalPosts.isDemo, false)]))) : Promise.resolve([]),
    flags.pakistaniBrands ? getPublicBrands() : Promise.resolve([]),
    flags.pakistaniBrands ? getPublicBrandProducts() : Promise.resolve([]),
  ]);
  const cmsPages = await d.select({ slug: pages.slug, updatedAt: pages.updatedAt }).from(pages).where(eq(pages.status, "published"));
  const staticPages = [
    "",
    "/shop",
    "/artisans",
    "/collections",
    "/about",
    "/contact",
    "/how-importing-works",
    "/buyer-protection",
    "/faq",
    "/become-a-seller",
    "/track",
    "/haveli",
    ...(flags.journal ? ["/journal"] : []),
    ...(flags.customRequests ? ["/custom"] : []),
    ...(flags.wholesale ? ["/wholesale"] : []),
    ...(flags.limitedDrops ? ["/drops"] : []),
    ...(flags.pakistaniBrands ? ["/brands", "/brands/directory", "/brands/join"] : []),
  ];
  return [
    ...staticPages.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 })),
    ...cmsPages.filter((p) => !staticPages.includes(`/${p.slug}`)).map((p) => ({ url: `${base}/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "monthly" as const, priority: 0.4 })),
    ...categories.map((c) => ({ url: `${base}/category/${c.slug}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...vendors.map((v) => ({ url: `${base}/artisans/${v.slug}`, lastModified: v.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...products.items.map((p) => ({ url: `${base}/product/${p.slug}`, changeFrequency: "weekly" as const, priority: 0.9 })),
    ...brands.map((b) => ({ url: `${base}/brands/${b.slug}`, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...brandProducts.map((p) => ({ url: `${base}/brands/${p.brand.slug}/${p.slug}`, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...posts.map((p) => ({ url: `${base}/journal/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}
