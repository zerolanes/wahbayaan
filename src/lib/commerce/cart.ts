import "server-only";
import { cache } from "react";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { cartItems, carts, categories, coupons, productImages, products, vendors, wishlistItems } from "@/lib/db/schema";
import { getBuyerContext } from "@/lib/buyer-context";
import { getPublicVendorIds } from "@/lib/queries/catalog";
import { getPublicCollections } from "@/lib/queries/storefront";
import { computeBundleSavings } from "./bundles";
import { computeLandedCost, buyerUnitPrice, type LandedCost, type LcItem } from "./landed-cost";
import { getRateContext } from "./rates";
import { getSetting } from "@/lib/settings";
import { applyBps, convert } from "@/lib/money/currency";

export async function getOrCreateCart(ownerKey: string) {
  const d = await db();
  const existing = await d.query.carts.findFirst({ where: eq(carts.ownerKey, ownerKey) });
  if (existing) return existing;
  const [created] = await d.insert(carts).values({ ownerKey }).onConflictDoNothing().returning();
  return created ?? (await d.query.carts.findFirst({ where: eq(carts.ownerKey, ownerKey) }))!;
}

export const getCartCount = cache(async (ownerKey: string | null) => {
  if (!ownerKey) return 0;
  const d = await db();
  const [row] = await d
    .select({ n: sql<number>`coalesce(sum(${cartItems.qty}), 0)::int` })
    .from(cartItems)
    .innerJoin(carts, eq(carts.id, cartItems.cartId))
    .where(eq(carts.ownerKey, ownerKey));
  return row?.n ?? 0;
});

export const getWishlistIds = cache(async (ownerKey: string | null): Promise<Set<string>> => {
  if (!ownerKey) return new Set();
  const d = await db();
  const rows = await d.select({ id: wishlistItems.productId }).from(wishlistItems).where(eq(wishlistItems.ownerKey, ownerKey));
  return new Set(rows.map((r) => r.id));
});

export type CartLine = {
  id: string;
  productId: string;
  slug: string;
  title: string;
  imageUrl: string | null;
  vendorId: string;
  vendorName: string;
  vendorSlug: string;
  categoryName: string;
  qty: number;
  maxQty: number;
  unitPricePkr: number;
  unitPrice: number;
  lineTotal: number;
  customization: Record<string, string>;
  customizationLabels: { label: string; value: string }[];
  availability: "ready_to_ship" | "made_to_order";
  timeToMakeDays: number | null;
  dispatchDays: number | null;
  unavailableReason: string | null;
};

export type CartView = {
  cartId: string | null;
  lines: CartLine[];
  landed: LandedCost | null;
  couponCode: string | null;
  couponError: string | null;
  isGift: boolean;
  giftWrap: boolean;
  giftMessage: string | null;
};

/** Full cart with prices in the buyer's currency and the itemised landed cost. */
export async function loadCart(): Promise<CartView> {
  const ctx = await getBuyerContext();
  const empty: CartView = { cartId: null, lines: [], landed: null, couponCode: null, couponError: null, isGift: false, giftWrap: false, giftMessage: null };
  if (!ctx.ownerKey) return empty;
  const d = await db();
  const found = await d.query.carts.findFirst({ where: eq(carts.ownerKey, ctx.ownerKey) });
  if (!found) return empty;
  // With gifting switched off (Admin → Feature flags), stored gift options are ignored everywhere.
  const giftingOn = (await getSetting("feature_flags")).gifting;
  const cart = giftingOn ? found : { ...found, isGift: false, giftWrap: false, giftMessage: null };

  const rows = await d
    .select({
      item: cartItems,
      p: products,
      vendorName: vendors.displayName,
      vendorSlug: vendors.slug,
      categoryName: categories.name,
      hsCode: categories.hsCode,
    })
    .from(cartItems)
    .innerJoin(products, eq(products.id, cartItems.productId))
    .innerJoin(vendors, eq(vendors.id, products.vendorId))
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(eq(cartItems.cartId, cart.id))
    .orderBy(asc(cartItems.createdAt));

  const images = rows.length
    ? await d.select().from(productImages).where(inArray(productImages.productId, rows.map((r) => r.p.id))).orderBy(asc(productImages.sort))
    : [];
  const publicVendors = await getPublicVendorIds();
  const fx = ctx.fx;

  const lines: CartLine[] = rows.map(({ item, p, vendorName, vendorSlug, categoryName }) => {
    const extra = p.customizationOptions
      .filter((o) => o.extraPricePkr && item.customization[o.id])
      .reduce((a, o) => a + (o.extraPricePkr ?? 0), 0);
    const unitPricePkr = p.pricePkr + extra;
    const unitPrice = fx ? buyerUnitPrice(unitPricePkr, fx) : 0;
    const unavailableReason =
      p.status !== "active" || !publicVendors.has(p.vendorId)
        ? "No longer available"
        : p.availability === "ready_to_ship" && p.stockQty < item.qty
          ? p.stockQty === 0
            ? "Sold out"
            : `Only ${p.stockQty} left`
          : p.isLimitedDrop && p.dropStartsAt && p.dropStartsAt > new Date()
            ? "Not released yet"
            : null;
    return {
      id: item.id,
      productId: p.id,
      slug: p.slug,
      title: p.title,
      imageUrl: images.find((i) => i.productId === p.id)?.url ?? null,
      vendorId: p.vendorId,
      vendorName,
      vendorSlug,
      categoryName,
      qty: item.qty,
      maxQty: p.availability === "made_to_order" ? 10 : Math.max(1, p.stockQty),
      unitPricePkr,
      unitPrice,
      lineTotal: unitPrice * item.qty,
      customization: item.customization,
      customizationLabels: p.customizationOptions
        .filter((o) => item.customization[o.id])
        .map((o) => ({ label: o.label, value: item.customization[o.id] })),
      availability: p.availability,
      timeToMakeDays: p.timeToMakeDays,
      dispatchDays: p.dispatchDays,
      unavailableReason,
    };
  });

  let couponError: string | null = null;
  let discount: { amount: number; label: string } | undefined;
  if (cart.couponCode && fx) {
    const c = await d.query.coupons.findFirst({ where: and(eq(coupons.code, cart.couponCode), eq(coupons.isActive, true)) });
    const subtotal = lines.reduce((a, l) => a + l.lineTotal, 0);
    const now = new Date();
    if (!c) couponError = "This code isn't valid";
    else if ((c.startsAt && c.startsAt > now) || (c.endsAt && c.endsAt < now)) couponError = "This code has expired";
    else if (c.maxUses != null && c.usedCount >= c.maxUses) couponError = "This code has been fully used";
    else {
      const fxTable = (await getRateContext(ctx.destination)).fxTable;
      const minSub = c.minSubtotal && c.currency ? (fxTable[c.currency] ? convert(c.minSubtotal, fxTable[c.currency]!, fx) : null) : null;
      if (minSub != null && subtotal < minSub) couponError = "Your order doesn't meet this code's minimum";
      else if (c.kind === "percent" && c.percentBps) discount = { amount: applyBps(subtotal, c.percentBps), label: `Code ${c.code}` };
      else if (c.kind === "fixed" && c.amount && c.currency && fxTable[c.currency])
        discount = { amount: convert(c.amount, fxTable[c.currency]!, fx), label: `Code ${c.code}` };
      else couponError = "This code can't be used with your currency";
    }
  }

  const available = lines.filter((l) => !l.unavailableReason);

  // Bundle savings: a published bundle's discount applies once all its pieces are in the cart.
  if (fx && available.length > 1) {
    const bundles = (await getPublicCollections()).filter((c) => c.kind === "bundle" && c.bundleDiscountBps);
    const saving = computeBundleSavings(
      bundles.map((b) => ({ slug: b.slug, title: b.title, bundleDiscountBps: b.bundleDiscountBps, productIds: b.products.map((p) => p.id) })),
      available.map((l) => ({ productId: l.productId, unitPrice: l.unitPrice, qty: l.qty })),
    );
    if (saving) discount = discount ? { amount: discount.amount + saving.amount, label: `${discount.label} + ${saving.label}` } : { amount: saving.amount, label: saving.label };
  }

  let landed: LandedCost | null = null;
  if (fx && available.length) {
    const rates = await getRateContext(ctx.destination);
    const lcItems: LcItem[] = [];
    for (const l of available) {
      const p = rows.find((r) => r.item.id === l.id)!;
      lcItems.push({
        productId: l.productId,
        vendorId: l.vendorId,
        categoryId: p.p.categoryId,
        hsCode: p.p.hsCodeOverride ?? p.hsCode,
        title: l.title,
        unitPricePkr: l.unitPricePkr,
        qty: l.qty,
        weightG: p.p.weightG,
        availability: l.availability,
        timeToMakeDays: l.timeToMakeDays,
        dispatchDays: l.dispatchDays,
      });
    }
    landed = computeLandedCost({
      items: lcItems,
      destination: ctx.destination,
      fx,
      fxTable: rates.fxTable,
      shippingRates: rates.shippingRates,
      dutyRates: rates.dutyRates,
      handling: rates.handling,
      giftWrap: cart.isGift ? { selected: cart.giftWrap, setting: rates.giftWrap } : undefined,
      discount,
    });
  }

  return {
    cartId: cart.id,
    lines,
    landed,
    couponCode: cart.couponCode,
    couponError,
    isGift: cart.isGift,
    giftWrap: cart.giftWrap,
    giftMessage: cart.giftMessage,
  };
}

/** Landed-cost estimate for a single product (product page). */
export async function estimateForProduct(productId: string, qty = 1) {
  const ctx = await getBuyerContext();
  if (!ctx.fx) return null;
  const d = await db();
  const [row] = await d
    .select({ p: products, hsCode: categories.hsCode })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(eq(products.id, productId));
  if (!row) return null;
  const rates = await getRateContext(ctx.destination);
  return computeLandedCost({
    items: [
      {
        productId,
        vendorId: row.p.vendorId,
        categoryId: row.p.categoryId,
        hsCode: row.p.hsCodeOverride ?? row.hsCode,
        title: row.p.title,
        unitPricePkr: row.p.pricePkr,
        qty,
        weightG: row.p.weightG,
        availability: row.p.availability,
        timeToMakeDays: row.p.timeToMakeDays,
        dispatchDays: row.p.dispatchDays,
      },
    ],
    destination: ctx.destination,
    fx: ctx.fx,
    fxTable: rates.fxTable,
    shippingRates: rates.shippingRates,
    dutyRates: rates.dutyRates,
    handling: rates.handling,
  });
}

/** Move a guest's cart and wishlist onto their account after sign-in. */
export async function mergeVisitorIntoUser(visitorOwnerKey: string, userId: string) {
  const d = await db();
  const userKey = `user:${userId}`;
  const guestCart = await d.query.carts.findFirst({ where: eq(carts.ownerKey, visitorOwnerKey) });
  if (guestCart) {
    const userCart = await getOrCreateCart(userKey);
    const guestItems = await d.select().from(cartItems).where(eq(cartItems.cartId, guestCart.id));
    const userItems = await d.select().from(cartItems).where(eq(cartItems.cartId, userCart.id));
    for (const gi of guestItems) {
      const same = userItems.find((u) => u.productId === gi.productId && JSON.stringify(u.customization) === JSON.stringify(gi.customization));
      if (same) await d.update(cartItems).set({ qty: same.qty + gi.qty }).where(eq(cartItems.id, same.id));
      else await d.update(cartItems).set({ cartId: userCart.id }).where(eq(cartItems.id, gi.id));
    }
    await d.delete(carts).where(eq(carts.id, guestCart.id));
  }
  const guestWish = await d.select().from(wishlistItems).where(eq(wishlistItems.ownerKey, visitorOwnerKey));
  for (const w of guestWish) {
    await d.insert(wishlistItems).values({ ownerKey: userKey, productId: w.productId }).onConflictDoNothing();
  }
  await d.delete(wishlistItems).where(eq(wishlistItems.ownerKey, visitorOwnerKey));
}
