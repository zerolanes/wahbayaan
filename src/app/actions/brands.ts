"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { brandAlerts, brandCartItems, brandCarts, brands } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { getBuyerContext } from "@/lib/buyer-context";
import { getOrCreateBrandCart, loadBrandBag, resolveShipTo } from "@/lib/brands/bag";
import { createLinkRequest, placeBrandOrder } from "@/lib/brands/orders";
import { parseRequestItems, type RequestItemInput } from "@/lib/brands/requests";
import { beginPayment, OrderError } from "@/lib/commerce/orders";
import { isBuyerDestination, isDomestic } from "@/lib/money/currency";
import { rememberOrder, requestOrigin } from "@/lib/order-access";
import { PAYMENT_METHODS, type PaymentMethodId } from "@/lib/payments/methods";
import { getBuyableVariant } from "@/lib/queries/brands";

export type BrandFormState = { ok?: boolean; message?: string; error?: string; fieldErrors?: Record<string, string> } | null;

// ── Bag ─────────────────────────────────────────────────────────────────────

export async function addToBrandBagForm(_prev: BrandFormState, formData: FormData): Promise<BrandFormState> {
  const ctx = await getBuyerContext();
  if (!ctx.ownerKey) return { error: "Please enable cookies to use the bag." };
  const variantId = String(formData.get("variantId") ?? "");
  const qty = Math.max(1, Math.min(20, Math.floor(Number(formData.get("qty") ?? 1)) || 1));
  if (!variantId) return { error: "Choose a size and colour first." };
  const found = await getBuyableVariant(variantId);
  if (!found) return { error: "This item is no longer available." };
  const { variant, product } = found;
  if (!variant.available || variant.stockQty === 0) return { error: "That size is sold out at the brand." };
  const cart = await getOrCreateBrandCart(ctx.ownerKey);
  const d = await db();
  const existing = await d.query.brandCartItems.findFirst({ where: and(eq(brandCartItems.cartId, cart.id), eq(brandCartItems.variantId, variantId)) });
  const newQty = (existing?.qty ?? 0) + qty;
  if (variant.stockQty != null && newQty > variant.stockQty) return { error: `Only ${variant.stockQty} left in that size.` };
  if (existing) await d.update(brandCartItems).set({ qty: newQty }).where(eq(brandCartItems.id, existing.id));
  else await d.insert(brandCartItems).values({ cartId: cart.id, variantId, qty });
  refresh();
  const label = [variant.size, variant.colour].filter(Boolean).join(" · ");
  return { ok: true, message: `${product.title}${label ? ` (${label})` : ""} added to your bag.` };
}

export async function updateBrandBagLine(formData: FormData) {
  const ctx = await getBuyerContext();
  if (!ctx.ownerKey) return;
  const d = await db();
  const cart = await d.query.brandCarts.findFirst({ where: eq(brandCarts.ownerKey, ctx.ownerKey) });
  if (!cart) return;
  const id = String(formData.get("itemId") ?? "");
  const qty = Math.floor(Number(formData.get("qty") ?? 0));
  if (qty <= 0) await d.delete(brandCartItems).where(and(eq(brandCartItems.id, id), eq(brandCartItems.cartId, cart.id)));
  else await d.update(brandCartItems).set({ qty: Math.min(qty, 20) }).where(and(eq(brandCartItems.id, id), eq(brandCartItems.cartId, cart.id)));
  refresh();
}

/** Overseas buyers: ship to their own country (`home`) or to an address in Pakistan (`PK`, e.g. an Eid gift). */
export async function setBrandShipTo(formData: FormData) {
  const ctx = await getBuyerContext();
  if (!ctx.ownerKey) return;
  const mode = formData.get("shipTo") === "PK" ? "PK" : "home";
  const cart = await getOrCreateBrandCart(ctx.ownerKey);
  const d = await db();
  await d.update(brandCarts).set({ shipTo: mode, isGift: mode === "PK" && !isDomestic(ctx.destination) }).where(eq(brandCarts.id, cart.id));
  refresh();
}

// ── Checkout ────────────────────────────────────────────────────────────────

const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

const contactAddress = z.object({
  email: z.email("Please enter a valid email"),
  customerName: z.string().trim().min(2, "Please enter your name").max(120),
  fullName: z.string().trim().min(2, "Who should the courier deliver to?").max(120),
  line1: z.string().trim().min(3, "Enter the street address").max(200),
  line2: opt(200),
  city: z.string().trim().min(2, "Enter the town or city").max(120),
  region: opt(120),
  postalCode: opt(20),
  phone: z.string().trim().min(6, "A phone number helps the courier deliver").max(40),
  method: z.enum(PAYMENT_METHODS, "Choose how you'd like to pay"),
  buyerNotes: opt(1000),
  giftMessage: opt(500),
});

function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of error.issues) out[String(i.path[0])] ??= i.message;
  return out;
}

function stringEntries(fd: FormData) {
  return Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string"));
}

async function payOrWait(order: { number: string; totalComplete: boolean }, placedPath: string) {
  await rememberOrder(order.number);
  if (order.totalComplete) {
    let url: string;
    try {
      url = (await beginPayment(order.number, await requestOrigin())).redirectUrl;
    } catch (e) {
      console.error("beginPayment failed", e);
      redirect(`${placedPath}?order=${order.number}&payment=unavailable`);
    }
    redirect(url);
  }
  redirect(`${placedPath}?order=${order.number}`);
}

export async function placeBrandOrderAction(_prev: BrandFormState, formData: FormData): Promise<BrandFormState> {
  const parsed = contactAddress.safeParse(stringEntries(formData));
  if (!parsed.success) return { error: "Please check the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  const f = parsed.data;
  const user = await getCurrentUser();
  const bag = await loadBrandBag({ city: f.city });
  if (!isDomestic(bag.shipTo) && !f.postalCode) return { error: "Please complete the delivery address.", fieldErrors: { postalCode: "Couriers need a postal code" } };
  let order;
  try {
    order = await placeBrandOrder({
      bag,
      userId: user?.id ?? null,
      email: f.email.toLowerCase(),
      customerName: f.customerName,
      address: { fullName: f.fullName, line1: f.line1, line2: f.line2, city: f.city, region: f.region, postalCode: f.postalCode, country: bag.shipTo, phone: f.phone },
      method: f.method as PaymentMethodId,
      buyerNotes: f.buyerNotes,
      giftMessage: f.giftMessage,
    });
  } catch (e) {
    if (e instanceof OrderError) return { error: e.message };
    throw e;
  }
  await payOrWait(order, "/brands/order-placed");
  return null;
}

// ── Shop any brand by link ──────────────────────────────────────────────────

export async function createBrandRequestAction(_prev: BrandFormState, formData: FormData): Promise<BrandFormState> {
  const ctx = await getBuyerContext();
  const rows: RequestItemInput[] = [];
  for (let i = 0; i < 10; i++) {
    const get = (k: string) => String(formData.get(`items.${i}.${k}`) ?? "");
    if (!formData.has(`items.${i}.url`)) continue;
    rows.push({ url: get("url"), productName: get("productName"), brandName: get("brandName"), size: get("size"), colour: get("colour"), qty: Number(get("qty") || 1), notes: get("notes") });
  }
  const items = parseRequestItems(rows);
  const parsed = contactAddress.safeParse(stringEntries(formData));
  const errors = { ...items.errors, ...(parsed.success ? {} : fieldErrors(parsed.error)) };
  const shipMode = String(formData.get("shipTo") ?? "home");
  const { shipTo } = resolveShipTo(ctx, shipMode === "PK" ? "PK" : "home");
  if (!isBuyerDestination(shipTo)) errors.shipTo = "Choose where it ships";
  if (parsed.success && !isDomestic(shipTo) && !parsed.data.postalCode) errors.postalCode = "Couriers need a postal code";
  if (Object.keys(errors).length || !parsed.success) return { error: "Please check the highlighted fields.", fieldErrors: errors };
  const f = parsed.data;
  const user = await getCurrentUser();
  let order;
  try {
    order = await createLinkRequest({
      items: items.items,
      shipTo,
      userId: user?.id ?? null,
      email: f.email.toLowerCase(),
      customerName: f.customerName,
      address: { fullName: f.fullName, line1: f.line1, line2: f.line2, city: f.city, region: f.region, postalCode: f.postalCode, country: shipTo, phone: f.phone },
      method: f.method as PaymentMethodId,
      buyerNotes: f.buyerNotes,
      giftMessage: f.giftMessage,
    });
  } catch (e) {
    if (e instanceof OrderError) return { error: e.message };
    throw e;
  }
  await rememberOrder(order.number);
  redirect(`/brands/order-placed?order=${order.number}&request=1`);
}

// ── Notify me (sale / restock) ──────────────────────────────────────────────

export async function subscribeBrandAlert(_prev: BrandFormState, formData: FormData): Promise<BrandFormState> {
  const parsed = z
    .object({ email: z.email("Enter a valid email"), brandId: z.uuid(), productId: z.uuid().optional().or(z.literal("")), kind: z.enum(["sale", "restock"]) })
    .safeParse(stringEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const d = await db();
  const brand = await d.query.brands.findFirst({ where: eq(brands.id, parsed.data.brandId) });
  if (!brand) return { error: "Brand not found." };
  const user = await getCurrentUser();
  const productId = parsed.data.productId || null;
  const existing = await d.query.brandAlerts.findFirst({
    where: and(eq(brandAlerts.email, parsed.data.email.toLowerCase()), eq(brandAlerts.brandId, brand.id), eq(brandAlerts.kind, parsed.data.kind)),
  });
  if (!existing || existing.productId !== productId)
    await d.insert(brandAlerts).values({ email: parsed.data.email.toLowerCase(), userId: user?.id ?? null, brandId: brand.id, productId, kind: parsed.data.kind });
  return { ok: true, message: parsed.data.kind === "sale" ? "We'll email you when it goes on sale." : "We'll email you when it's back in stock." };
}
