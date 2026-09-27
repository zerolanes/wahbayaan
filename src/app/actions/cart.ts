"use server";

import { refresh } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { cartItems, carts, products, wishlistItems } from "@/lib/db/schema";
import { getBuyerContext } from "@/lib/buyer-context";
import { getOrCreateCart } from "@/lib/commerce/cart";
import { getPublicCollection } from "@/lib/queries/storefront";
import { addToCart } from "./storefront";

export type CartFormState = { ok?: boolean; error?: string; message?: string } | null;

/** The cart line, only if it belongs to this visitor's own cart. */
async function ownLine(lineId: string) {
  const ctx = await getBuyerContext();
  if (!ctx.ownerKey || !/^[0-9a-f-]{36}$/i.test(lineId)) return null;
  const d = await db();
  const [row] = await d
    .select({ item: cartItems, product: products })
    .from(cartItems)
    .innerJoin(carts, eq(carts.id, cartItems.cartId))
    .innerJoin(products, eq(products.id, cartItems.productId))
    .where(and(eq(cartItems.id, lineId), eq(carts.ownerKey, ctx.ownerKey)));
  return row ?? null;
}

export async function updateCartQty(formData: FormData) {
  const line = await ownLine(String(formData.get("lineId") ?? ""));
  if (!line) return;
  const max = line.product.availability === "made_to_order" ? 10 : Math.max(1, line.product.stockQty);
  const qty = Math.max(1, Math.min(max, Math.floor(Number(formData.get("qty")) || 1)));
  const d = await db();
  await d.update(cartItems).set({ qty }).where(eq(cartItems.id, line.item.id));
  refresh();
}

export async function removeCartLine(formData: FormData) {
  const line = await ownLine(String(formData.get("lineId") ?? ""));
  if (!line) return;
  const d = await db();
  await d.delete(cartItems).where(eq(cartItems.id, line.item.id));
  refresh();
}

/** Remove from the cart and keep it in the wishlist for later. */
export async function saveLineForLater(formData: FormData) {
  const line = await ownLine(String(formData.get("lineId") ?? ""));
  const ctx = await getBuyerContext();
  if (!line || !ctx.ownerKey) return;
  const d = await db();
  await d.insert(wishlistItems).values({ ownerKey: ctx.ownerKey, productId: line.product.id }).onConflictDoNothing();
  await d.delete(cartItems).where(eq(cartItems.id, line.item.id));
  refresh();
}

export async function applyCoupon(_prev: CartFormState, formData: FormData): Promise<CartFormState> {
  const ctx = await getBuyerContext();
  const code = String(formData.get("code") ?? "").trim().toUpperCase().slice(0, 40);
  if (!ctx.ownerKey) return { error: "Please enable cookies to use the cart." };
  if (!code) return { error: "Enter a code first." };
  const d = await db();
  const cart = await getOrCreateCart(ctx.ownerKey);
  await d.update(carts).set({ couponCode: code }).where(eq(carts.id, cart.id));
  refresh();
  return { ok: true };
}

export async function removeCoupon() {
  const ctx = await getBuyerContext();
  if (!ctx.ownerKey) return;
  const d = await db();
  await d.update(carts).set({ couponCode: null }).where(eq(carts.ownerKey, ctx.ownerKey));
  refresh();
}

export async function saveGiftOptions(_prev: CartFormState, formData: FormData): Promise<CartFormState> {
  const ctx = await getBuyerContext();
  if (!ctx.ownerKey) return { error: "Please enable cookies to use the cart." };
  const isGift = formData.get("isGift") === "on";
  const message = String(formData.get("giftMessage") ?? "").trim().slice(0, 500);
  const d = await db();
  const cart = await getOrCreateCart(ctx.ownerKey);
  await d
    .update(carts)
    .set({ isGift, giftWrap: isGift && formData.get("giftWrap") === "on", giftMessage: isGift && message ? message : null })
    .where(eq(carts.id, cart.id));
  refresh();
  return { ok: true, message: isGift ? "Gift options saved." : "Gift options removed." };
}

export async function moveWishlistToCart(_prev: CartFormState, formData: FormData): Promise<CartFormState> {
  const ctx = await getBuyerContext();
  const productId = String(formData.get("productId") ?? "");
  if (!ctx.ownerKey) return { error: "Please enable cookies to use the cart." };
  const d = await db();
  const product = await d.query.products.findFirst({ where: eq(products.id, productId) });
  if (!product) return { error: "This piece is no longer listed." };
  if (product.customizationOptions.some((o) => o.required)) return { error: "Choose its options on the product page first." };
  const r = await addToCart(productId, 1, {});
  if (!r.ok) return { error: r.error };
  await d.delete(wishlistItems).where(and(eq(wishlistItems.ownerKey, ctx.ownerKey), eq(wishlistItems.productId, productId)));
  refresh();
  return { ok: true, message: "Moved to your cart." };
}

export async function removeFromWishlist(formData: FormData) {
  const ctx = await getBuyerContext();
  if (!ctx.ownerKey) return;
  const d = await db();
  await d.delete(wishlistItems).where(and(eq(wishlistItems.ownerKey, ctx.ownerKey), eq(wishlistItems.productId, String(formData.get("productId") ?? ""))));
  refresh();
}

/** "Add all to cart" for a collection or bundle. Pieces needing choices are skipped and named. */
export async function addCollectionToCart(_prev: CartFormState, formData: FormData): Promise<CartFormState> {
  const collection = await getPublicCollection(String(formData.get("slug") ?? ""));
  if (!collection) return { error: "This collection isn't available." };
  const d = await db();
  const skipped: string[] = [];
  let added = 0;
  for (const p of collection.products) {
    const full = await d.query.products.findFirst({ where: eq(products.id, p.id) });
    if (!full || full.customizationOptions.some((o) => o.required) || (full.isLimitedDrop && full.dropStartsAt && full.dropStartsAt > new Date())) {
      skipped.push(p.title);
      continue;
    }
    const r = await addToCart(p.id, 1, {});
    if (r.ok) added++;
    else skipped.push(p.title);
  }
  refresh();
  if (!added) return { error: `Nothing could be added${skipped.length ? ` — ${skipped.join(", ")} need choices on their own page or are already in your cart` : ""}.` };
  return {
    ok: true,
    message: `${added} ${added === 1 ? "piece" : "pieces"} added to your cart.${skipped.length ? ` Not added: ${skipped.join(", ")} (choose options on its page, or it's already in your cart).` : ""}`,
  };
}
