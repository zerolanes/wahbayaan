"use server";

import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { cartItems, products, wishlistItems } from "@/lib/db/schema";
import { CURRENCY_COOKIE, DESTINATION_COOKIE, getBuyerContext } from "@/lib/buyer-context";
import { getOrCreateCart } from "@/lib/commerce/cart";
import { isBuyerCurrency, isDestination } from "@/lib/money/currency";

const YEAR = 60 * 60 * 24 * 365;

/** Buyer preferences: destination country and (optionally) an explicit currency. */
export async function setBuyerPreferences(formData: FormData) {
  const jar = await cookies();
  const dest = formData.get("destination");
  const currency = formData.get("currency");
  if (isDestination(dest)) jar.set(DESTINATION_COOKIE, dest, { path: "/", maxAge: YEAR, sameSite: "lax" });
  if (currency === "auto") jar.delete(CURRENCY_COOKIE);
  else if (isBuyerCurrency(currency)) jar.set(CURRENCY_COOKIE, currency, { path: "/", maxAge: YEAR, sameSite: "lax" });
}

export async function toggleWishlist(productId: string): Promise<{ saved: boolean }> {
  const ctx = await getBuyerContext();
  if (!ctx.ownerKey) return { saved: false };
  const d = await db();
  const existing = await d.query.wishlistItems.findFirst({
    where: and(eq(wishlistItems.ownerKey, ctx.ownerKey), eq(wishlistItems.productId, productId)),
  });
  if (existing) {
    await d.delete(wishlistItems).where(eq(wishlistItems.id, existing.id));
    refresh();
    return { saved: false };
  }
  await d.insert(wishlistItems).values({ ownerKey: ctx.ownerKey, productId }).onConflictDoNothing();
  refresh();
  return { saved: true };
}

export type AddToCartResult = { ok: true } | { ok: false; error: string };

export async function addToCart(productId: string, qty = 1, customization: Record<string, string> = {}): Promise<AddToCartResult> {
  const ctx = await getBuyerContext();
  if (!ctx.ownerKey) return { ok: false, error: "Please enable cookies to use the cart." };
  const d = await db();
  const product = await d.query.products.findFirst({ where: eq(products.id, productId) });
  if (!product || product.status !== "active") return { ok: false, error: "This piece is no longer available." };
  if (product.isLimitedDrop && product.dropStartsAt && product.dropStartsAt > new Date())
    return { ok: false, error: "This drop hasn't opened yet — join the waitlist instead." };
  for (const opt of product.customizationOptions) {
    const v = customization[opt.id]?.trim();
    if (opt.required && !v) return { ok: false, error: `Please fill in “${opt.label}”.` };
    if (v && opt.maxLength && v.length > opt.maxLength) return { ok: false, error: `“${opt.label}” is too long.` };
    if (v && opt.kind === "select" && opt.choices && !opt.choices.includes(v)) return { ok: false, error: `Choose a valid “${opt.label}”.` };
  }
  const clean = Object.fromEntries(Object.entries(customization).filter(([, v]) => v?.trim()));
  const cart = await getOrCreateCart(ctx.ownerKey);
  const existing = (await d.select().from(cartItems).where(and(eq(cartItems.cartId, cart.id), eq(cartItems.productId, productId)))).find(
    (i) => JSON.stringify(i.customization) === JSON.stringify(clean),
  );
  const newQty = (existing?.qty ?? 0) + Math.max(1, Math.floor(qty));
  if (product.availability === "ready_to_ship" && newQty > product.stockQty)
    return { ok: false, error: product.stockQty <= (existing?.qty ?? 0) ? "You already have every one in your cart." : `Only ${product.stockQty} available.` };
  if (existing) await d.update(cartItems).set({ qty: newQty }).where(eq(cartItems.id, existing.id));
  else await d.insert(cartItems).values({ cartId: cart.id, productId, qty: newQty, customization: clean });
  refresh();
  return { ok: true };
}
