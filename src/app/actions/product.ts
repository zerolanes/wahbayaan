"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { conversations, products, reviewPhotos, reviews, vendors, waitlistEntries } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { getPublicVendorIds } from "@/lib/queries/catalog";
import { getReviewEligibility } from "@/lib/queries/account";
import { saveUploads } from "@/lib/storage";
import { addToCart } from "./storefront";

export type FormState = { ok?: boolean; error?: string; message?: string } | null;

/** Form wrapper around `addToCart`: reads quantity and `opt_<id>` customisation fields. */
export async function addToCartForm(_prev: FormState, formData: FormData): Promise<FormState> {
  const productId = String(formData.get("productId") ?? "");
  const qty = Math.max(1, Math.min(50, Number(formData.get("qty") ?? 1) || 1));
  const customization: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (k.startsWith("opt_") && typeof v === "string") customization[k.slice(4)] = v;
  const r = await addToCart(productId, qty, customization);
  return r.ok ? { ok: true, message: "Added to your cart" } : { error: r.error };
}

export async function joinWaitlist(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ productId: z.uuid(), email: z.email("Please enter a valid email") }).safeParse({
    productId: formData.get("productId"),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = await db();
  const product = await d.query.products.findFirst({ where: eq(products.id, parsed.data.productId) });
  if (!product || product.status !== "active" || !product.isLimitedDrop) return { error: "This drop isn't available." };
  const user = await getCurrentUser();
  await d.insert(waitlistEntries).values({ productId: product.id, email: parsed.data.email, userId: user?.id ?? null }).onConflictDoNothing();
  return { ok: true, message: "You're on the list — we'll email you the moment it opens." };
}

const reviewSchema = z.object({
  productId: z.uuid(),
  rating: z.coerce.number().int().min(1, "Choose a star rating").max(5),
  title: z.string().trim().max(120).optional(),
  body: z.string().trim().min(20, "Tell other buyers a little more (at least 20 characters)").max(4000),
});

export async function submitReview(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please sign in to review a piece you bought." };
  const parsed = reviewSchema.safeParse({
    productId: formData.get("productId"),
    rating: formData.get("rating") ?? 0,
    title: formData.get("title") || undefined,
    body: formData.get("body"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const eligibility = await getReviewEligibility(user.id, parsed.data.productId);
  if (!eligibility.eligible) return { error: "Reviews are open to buyers once their piece has been delivered." };
  const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > 6) return { error: "Please add up to 6 photos." };
  let urls: string[] = [];
  try {
    urls = await saveUploads(files, { uploadedById: user.id });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't upload those photos." };
  }
  const d = await db();
  const product = await d.query.products.findFirst({ where: eq(products.id, parsed.data.productId) });
  if (!product) return { error: "This piece is no longer listed." };
  const [review] = await d
    .insert(reviews)
    .values({
      productId: product.id,
      vendorId: product.vendorId,
      userId: user.id,
      orderItemId: eligibility.orderItemId,
      authorName: user.name.split(/\s+/)[0] ?? user.name,
      buyerCountry: user.country,
      rating: parsed.data.rating,
      title: parsed.data.title || null,
      body: parsed.data.body,
      status: "pending",
    })
    .returning();
  if (urls.length) await d.insert(reviewPhotos).values(urls.map((url) => ({ reviewId: review.id, url })));
  refresh();
  return { ok: true, message: "Thank you. Your review is with our team for a quick check and will appear here once it's approved." };
}

/** Opens (or reuses) a buyer ↔ artisan conversation and goes to it. */
export async function startConversation(formData: FormData) {
  const vendorId = String(formData.get("vendorId") ?? "");
  const productId = String(formData.get("productId") ?? "") || null;
  const back = String(formData.get("back") ?? "/");
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(back.startsWith("/") ? back : "/")}`);
  if (!(await getPublicVendorIds()).has(vendorId)) redirect(back);
  const d = await db();
  const existing = await d.query.conversations.findFirst({
    where: and(eq(conversations.buyerId, user.id), eq(conversations.vendorId, vendorId), productId ? eq(conversations.productId, productId) : undefined),
  });
  if (existing) redirect(`/account/messages/${existing.id}`);
  const product = productId ? await d.query.products.findFirst({ where: eq(products.id, productId) }) : null;
  const vendor = await d.query.vendors.findFirst({ where: eq(vendors.id, vendorId) });
  const [conv] = await d
    .insert(conversations)
    .values({ buyerId: user.id, vendorId, productId: product?.vendorId === vendorId ? product.id : null, subject: product ? `About “${product.title}”` : `Question for ${vendor?.displayName ?? "the artisan"}` })
    .returning();
  redirect(`/account/messages/${conv.id}`);
}
