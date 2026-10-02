import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { brandCartItems, brandCarts } from "@/lib/db/schema";
import { getBuyerContext, type BuyerContext } from "@/lib/buyer-context";
import { buyerUnitPrice, type LandedCost } from "@/lib/commerce/landed-cost";
import { isDomestic, ORIGIN_COUNTRY } from "@/lib/money/currency";
import { getPublicBrandProducts } from "@/lib/queries/brands";
import type { Partnership } from "./permission";
import { itemPricePkr } from "./catalog";
import { computeBrandQuote } from "./pricing";
import { getBrandPricingContext } from "./rates";

/**
 * The Pakistani Brands bag — separate from the artisan cart because the
 * delivery route (inside Pakistan vs abroad), fees and fulfilment differ.
 */
export type BagLine = {
  id: string;
  variantId: string;
  productId: string;
  slug: string;
  brandId: string;
  brandSlug: string;
  brandName: string;
  partnership: Partnership;
  title: string;
  imageUrl: string | null;
  size: string | null;
  colour: string | null;
  sku: string | null;
  sourceUrl: string | null;
  qty: number;
  unitPricePkr: number;
  unitPrice: number | null;
  lineTotal: number | null;
  weightG: number | null;
  unavailableReason: string | null;
};

export type ShipMode = "home" | "PK";

export type BrandBag = {
  cartId: string | null;
  lines: BagLine[];
  /** Where the box goes: `PK` or the buyer's overseas destination. */
  shipTo: string;
  /** True when an overseas buyer sends the box to Pakistan. */
  giftToPakistan: boolean;
  /** Overseas buyers can choose; buyers in Pakistan always ship within Pakistan. */
  canChooseShipTo: boolean;
  giftMessage: string | null;
  quote: (LandedCost & { serviceFeePkr: number | null; itemsSubtotalPkr: number }) | null;
};

export function resolveShipTo(ctx: Pick<BuyerContext, "destination">, mode: string | null | undefined) {
  if (isDomestic(ctx.destination)) return { shipTo: ORIGIN_COUNTRY, gift: false, canChoose: false };
  if (mode === "PK") return { shipTo: ORIGIN_COUNTRY, gift: true, canChoose: true };
  return { shipTo: ctx.destination as string, gift: false, canChoose: true };
}

export async function getOrCreateBrandCart(ownerKey: string) {
  const d = await db();
  const existing = await d.query.brandCarts.findFirst({ where: eq(brandCarts.ownerKey, ownerKey) });
  if (existing) return existing;
  const [created] = await d.insert(brandCarts).values({ ownerKey }).onConflictDoNothing().returning();
  return created ?? (await d.query.brandCarts.findFirst({ where: eq(brandCarts.ownerKey, ownerKey) }))!;
}

export async function getBrandBagCount(ownerKey: string | null) {
  if (!ownerKey) return 0;
  const d = await db();
  const cart = await d.query.brandCarts.findFirst({ where: eq(brandCarts.ownerKey, ownerKey), with: { items: true } });
  return cart?.items.reduce((a, i) => a + i.qty, 0) ?? 0;
}

/** The bag with prices in the buyer's currency and the itemised quote. `city` refines domestic delivery. */
export async function loadBrandBag(opts: { city?: string | null } = {}): Promise<BrandBag> {
  const ctx = await getBuyerContext();
  const route = resolveShipTo(ctx, null);
  const empty: BrandBag = { cartId: null, lines: [], shipTo: route.shipTo, giftToPakistan: false, canChooseShipTo: route.canChoose, giftMessage: null, quote: null };
  if (!ctx.ownerKey) return empty;
  const d = await db();
  const cart = await d.query.brandCarts.findFirst({ where: eq(brandCarts.ownerKey, ctx.ownerKey) });
  if (!cart) return empty;
  const { shipTo, gift, canChoose } = resolveShipTo(ctx, cart.shipTo);
  const items = await d.select().from(brandCartItems).where(eq(brandCartItems.cartId, cart.id)).orderBy(asc(brandCartItems.createdAt));
  const products = await getPublicBrandProducts();

  const lines: BagLine[] = [];
  for (const item of items) {
    const product = products.find((p) => p.variants.some((v) => v.id === item.variantId));
    const variant = product?.variants.find((v) => v.id === item.variantId);
    if (!product || !variant) {
      // No longer buyable (hidden, removed or permission withdrawn): drop it from the bag.
      await d.delete(brandCartItems).where(eq(brandCartItems.id, item.id));
      continue;
    }
    const unitPricePkr = itemPricePkr(product, variant);
    const unitPrice = ctx.fx ? buyerUnitPrice(unitPricePkr, ctx.fx) : null;
    const unavailableReason = !variant.available
      ? "Sold out at the brand"
      : variant.stockQty != null && item.qty > variant.stockQty
        ? `Only ${variant.stockQty} left`
        : null;
    lines.push({
      id: item.id,
      variantId: variant.id,
      productId: product.id,
      slug: product.slug,
      brandId: product.brandId,
      brandSlug: product.brand.slug,
      brandName: product.brand.name,
      partnership: product.brand.partnership,
      title: product.title,
      imageUrl: product.images[0]?.url ?? null,
      size: variant.size,
      colour: variant.colour,
      sku: variant.sku,
      sourceUrl: product.sourceUrl,
      qty: item.qty,
      unitPricePkr,
      unitPrice,
      lineTotal: unitPrice == null ? null : unitPrice * item.qty,
      weightG: product.weightG ?? product.brand.defaultWeightG ?? null,
      unavailableReason,
    });
  }

  let quote: BrandBag["quote"] = null;
  if (lines.length && ctx.fx) {
    const rc = await getBrandPricingContext(shipTo);
    quote = computeBrandQuote({
      ...rc,
      items: lines.map((l) => ({ key: l.variantId, title: l.title, unitPricePkr: l.unitPricePkr, qty: l.qty, weightG: l.weightG })),
      shipTo,
      city: opts.city ?? null,
      fx: ctx.fx,
    });
  }
  return { cartId: cart.id, lines, shipTo, giftToPakistan: gift, canChooseShipTo: canChoose, giftMessage: cart.giftMessage, quote };
}
