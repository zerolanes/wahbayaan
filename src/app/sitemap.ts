import type { MetadataRoute } from "next";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { journalPosts } from "@/lib/db/schema";
import { getPublicCategories, getPublicProducts, getPublicVendors } from "@/lib/queries/catalog";
import { isDemoMode } from "@/lib/settings";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const d = await db();
  const [categories, vendors, products, posts] = await Promise.all([
    getPublicCategories(),
    getPublicVendors(),
    getPublicProducts({ limit: 5000 }),
    d.select().from(journalPosts).where(and(eq(journalPosts.status, "published"), ...(isDemoMode() ? [] : [eq(journalPosts.isDemo, false)]))),
  ]);
  const staticPages = ["", "/shop", "/artisans", "/how-importing-works", "/about", "/journal", "/collections", "/faq", "/contact", "/custom", "/wholesale", "/become-a-seller", "/buyer-protection"];
  return [
    ...staticPages.map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const, priority: p === "" ? 1 : 0.7 })),
    ...categories.map((c) => ({ url: `${base}/category/${c.slug}`, changeFrequency: "daily" as const, priority: 0.8 })),
    ...vendors.map((v) => ({ url: `${base}/artisans/${v.slug}`, lastModified: v.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...products.items.map((p) => ({ url: `${base}/product/${p.slug}`, changeFrequency: "weekly" as const, priority: 0.9 })),
    ...posts.map((p) => ({ url: `${base}/journal/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}
