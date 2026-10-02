import "server-only";
import { cache } from "react";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { brandProductImages, brandProducts, brandProductVariants, brands } from "@/lib/db/schema";
import { partnerLine } from "@/lib/brands/permission";
import { isNewArrival, itemPricePkr, sortSizes, wasPricePkr } from "@/lib/brands/catalog";
import { isBrandProductPublic, isBrandPublic } from "@/lib/trust/visibility";
import { visibilityContext } from "./catalog";

/**
 * Public Pakistani Brands queries. Every brand and brand product shown to buyers
 * goes through the guards in `src/lib/trust/visibility.ts`.
 */
export type PublicBrand = typeof brands.$inferSelect & {
  productCount: number;
  partnerLine: string;
};

export type PublicBrandProduct = typeof brandProducts.$inferSelect & {
  brand: PublicBrand;
  images: (typeof brandProductImages.$inferSelect)[];
  variants: (typeof brandProductVariants.$inferSelect)[];
  priceNowPkr: number;
  wasPkr: number | null;
  onSale: boolean;
  isNew: boolean;
  sizes: string[];
  colours: string[];
  inStock: boolean;
  publishedAt: Date | null;
};

const loadAll = cache(async () => {
  const d = await db();
  const ctx = visibilityContext();
  const [brandRows, productRows] = await Promise.all([d.select().from(brands).orderBy(asc(brands.sort), asc(brands.name)), d.select().from(brandProducts)]);
  const publicBrands = brandRows.filter((b) => isBrandPublic(b, ctx));
  const ids = productRows.filter((p) => publicBrands.some((b) => b.id === p.brandId)).map((p) => p.id);
  const [images, variants] = ids.length
    ? await Promise.all([
        d.select().from(brandProductImages).where(inArray(brandProductImages.productId, ids)).orderBy(asc(brandProductImages.sort)),
        d.select().from(brandProductVariants).where(inArray(brandProductVariants.productId, ids)).orderBy(asc(brandProductVariants.sort)),
      ])
    : [[], []];

  const brandMap = new Map<string, PublicBrand>(publicBrands.map((b) => [b.id, { ...b, productCount: 0, partnerLine: partnerLine(b.name) }]));
  const products: PublicBrandProduct[] = [];
  for (const p of productRows) {
    const brand = brandMap.get(p.brandId);
    if (!brand) continue;
    const imgs = images.filter((i) => i.productId === p.id);
    const vars = variants.filter((v) => v.productId === p.id);
    const visible = isBrandProductPublic(
      { title: p.title, status: p.status, imageCount: imgs.length, variantCount: vars.length, isDemo: p.isDemo, description: p.description },
      ctx,
    );
    if (!visible) continue;
    const prices = vars.map((v) => itemPricePkr(p, v));
    const priceNowPkr = prices.length ? Math.min(...prices) : itemPricePkr(p);
    const cheapest = vars.find((v) => itemPricePkr(p, v) === priceNowPkr) ?? null;
    const publishedAt = p.sourcePublishedAt ?? p.publishedAt;
    products.push({
      ...p,
      brand,
      images: imgs,
      variants: vars,
      priceNowPkr,
      wasPkr: wasPricePkr(p, cheapest),
      onSale: vars.some((v) => wasPricePkr(p, v) != null) || wasPricePkr(p) != null,
      isNew: isNewArrival(publishedAt),
      sizes: sortSizes(vars.map((v) => v.size).filter((s): s is string => !!s)),
      colours: [...new Set(vars.map((v) => v.colour).filter((c): c is string => !!c))],
      inStock: vars.some((v) => v.available && v.stockQty !== 0),
      publishedAt,
    });
    brand.productCount++;
  }
  return { brands: [...brandMap.values()], products };
});

export async function getPublicBrands() {
  return (await loadAll()).brands;
}

export async function getPublicBrand(slug: string) {
  return (await loadAll()).brands.find((b) => b.slug === slug) ?? null;
}

export async function getPublicBrandProducts(brandId?: string) {
  const all = (await loadAll()).products;
  return brandId ? all.filter((p) => p.brandId === brandId) : all;
}

export async function getPublicBrandProduct(brandSlug: string, productSlug: string) {
  return (await loadAll()).products.find((p) => p.slug === productSlug && p.brand.slug === brandSlug) ?? null;
}

/** For the bag: a variant with its product and brand, only if publicly buyable. */
export async function getBuyableVariant(variantId: string) {
  const d = await db();
  const v = await d.query.brandProductVariants.findFirst({ where: eq(brandProductVariants.id, variantId) });
  if (!v) return null;
  const product = (await loadAll()).products.find((p) => p.id === v.productId);
  if (!product) return null;
  return { variant: v, product };
}
