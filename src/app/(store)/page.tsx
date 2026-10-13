import type { Metadata } from "next";
import { desc, isNotNull, sql } from "drizzle-orm";
import { HeroSlider } from "@/components/store/home/hero-slider";
import {
  BestsellersSection,
  CollectionsSection,
  HeritageSection,
  JournalSection,
  MakersSection,
  StorySection,
  TrustSection,
  WeekSection,
  type BestsellerTab,
} from "@/components/store/home/sections";
import { flagOn } from "@/components/store/site-header";
import { PhoolDivider } from "@/components/store/truck-art";
import content from "@/content/home.json";
import { getBuyerContext } from "@/lib/buyer-context";
import { getWishlistIds } from "@/lib/commerce/cart";
import { db } from "@/lib/db/client";
import { orderItems } from "@/lib/db/schema";
import { featureFlags } from "@/lib/features";
import { getPublicBrandProducts, getPublicBrands } from "@/lib/queries/brands";
import { getPublicCategories, getPublicProducts, getPublicVendors, type ProductCardData } from "@/lib/queries/catalog";
import { getCompareIds, getJournalPosts, getPublicCollections } from "@/lib/queries/storefront";
import { SETTING_DEFAULTS, getSetting, isDemoMode } from "@/lib/settings";
import { SITE_DESCRIPTION, SITE_NAME, siteJsonLd } from "@/lib/seo";
import { activeSocialLinks } from "@/lib/social";

export const metadata: Metadata = {
  title: { absolute: `${SITE_NAME} — Pakistani heritage craft and brands` },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
};

/** Product ids ranked by units ordered (real order lines only; the public guards decide what shows). */
async function rankedByOrders(limit = 30): Promise<string[]> {
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

/**
 * Homepage (design direction C — modern glass with truck-art accents): hero
 * slider, collections, bestsellers, makers, lookbook, collection of the week,
 * story, journal and trust. Copy lives in `src/content/home.json`; every
 * listing goes through the public guards and every price through BuyerPrice.
 */
export default async function HomePage() {
  const [ctx, categories, vendors, flags, home, social, collections, journal, compared, rankedIds] = await Promise.all([
    getBuyerContext(),
    getPublicCategories(),
    getPublicVendors(),
    featureFlags(),
    getSetting("home"),
    getSetting("social_links"),
    getPublicCollections(),
    getJournalPosts(),
    getCompareIds(),
    rankedByOrders(),
  ]);

  const tabDefs = content.bestsellers.tabs.filter((t) => flagOn(flags, "flag" in t ? t.flag : undefined));
  const craftTabs = tabDefs.filter((t) => t.id !== "all" && t.id !== "brands" && categories.some((c) => c.slug === t.id));
  const [saved, ranked, featured, newest, brandList, brandProducts, ...perCraft] = await Promise.all([
    getWishlistIds(ctx.ownerKey),
    rankedIds.length ? getPublicProducts({ ids: rankedIds, limit: 30 }) : Promise.resolve({ items: [], total: 0 }),
    getPublicProducts({ featured: true, limit: 12 }),
    getPublicProducts({ sort: "newest", limit: 40 }),
    flags.pakistaniBrands ? getPublicBrands() : Promise.resolve([]),
    flags.pakistaniBrands ? getPublicBrandProducts() : Promise.resolve([]),
    ...craftTabs.map((t) => getPublicProducts({ categorySlug: t.id, sort: "featured", limit: 10 })),
  ]);

  // Bestsellers: order-ranked first (in rank order), topped up with featured, then newest.
  const rankedSorted = rankedIds.map((id) => ranked.items.find((p) => p.id === id)).filter((p): p is ProductCardData => !!p);
  const all = uniq([...rankedSorted, ...featured.items, ...newest.items]).slice(0, 10);
  const rank = (p: ProductCardData) => rankedIds.indexOf(p.id) + 1 || 999;
  const tabs: BestsellerTab[] = tabDefs
    .map((t): BestsellerTab | null => {
      if (t.id === "all") return { id: t.id, label: t.label, products: all, href: "/shop" };
      if (t.id === "brands") return brandProducts.length ? { id: t.id, label: t.label, brandProducts: brandProducts.filter((p) => p.inStock).slice(0, 10), href: "/brands" } : null;
      const i = craftTabs.findIndex((c) => c.id === t.id);
      if (i < 0) return null;
      return { id: t.id, label: t.label, products: [...perCraft[i].items].sort((a, b) => rank(a) - rank(b)), href: `/category/${t.id}` };
    })
    .filter((t): t is BestsellerTab => !!t);

  // Collections in the old site's order, then the rest.
  const order = content.collections.order;
  const crafts = categories
    .filter((c) => c.showOnHome && (c.productCount > 0 || isDemoMode()))
    .sort((a, b) => (order.indexOf(a.slug) + 1 || 99) - (order.indexOf(b.slug) + 1 || 99));

  // Makers: Admin → Content → Homepage order when set, else featured first.
  const makers = home.featuredVendorIds.length
    ? home.featuredVendorIds.map((id) => vendors.find((v) => v.id === id)).filter((v) => v !== undefined)
    : [...vendors.filter((v) => v.isFeatured), ...vendors.filter((v) => !v.isFeatured)];
  const vendorImage = new Map<string, string>();
  for (const p of [...featured.items, ...newest.items]) if (!vendorImage.has(p.vendorId)) vendorImage.set(p.vendorId, p.imageUrl);
  const brandImage = new Map<string, string>();
  for (const p of brandProducts) if (!brandImage.has(p.brandId) && p.images[0]) brandImage.set(p.brandId, p.images[0].url);
  const brands = brandList.filter((b) => b.productCount > 0);

  // Lookbook: one piece per craft where possible, newest first.
  const seen = new Set<string>();
  const looks = [...newest.items.filter((p) => !seen.has(p.categoryId) && seen.add(p.categoryId)), ...newest.items];
  const lookbook = uniq(looks)
    .filter((p, i, arr) => arr.findIndex((q) => q.imageUrl === p.imageUrl) === i)
    .slice(0, 8);

  const week = collections.find((c) => c.kind === "collection" && c.products.length >= 3) ?? collections[0] ?? null;
  const posts = flags.journal ? journal : [];

  // The hero line follows Admin → Content → Homepage once it is changed there; otherwise the design copy.
  const heroLine = home.heroTitle !== SETTING_DEFAULTS.home.heroTitle ? home.heroTitle : null;
  const slides = content.hero.slides.map((s) => (s.kind === "wordmark" && heroLine ? { ...s, line: heroLine } : s));

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: siteJsonLd(activeSocialLinks(social).map((l) => l.url)) }} />
      <HeroSlider slides={slides} label={content.hero.label} />
      <CollectionsSection categories={crafts} />
      <BestsellersSection tabs={tabs} saved={saved} compared={flags.compare ? compared : null} />
      <MakersSection vendors={makers} vendorImage={vendorImage} brands={brands} brandImage={brandImage} />
      <PhoolDivider className="mt-[60px] md:mt-20 lg:mt-[100px]" />
      <HeritageSection looks={lookbook} />
      <WeekSection collection={week} saved={saved} compared={flags.compare ? compared : null} />
      <StorySection storiesHref={flags.journal ? "/journal" : "/about"} />
      <PhoolDivider className="mt-[60px] md:mt-20 lg:mt-[100px]" />
      <JournalSection posts={posts} />
      <TrustSection />
    </>
  );
}
