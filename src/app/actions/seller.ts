"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { and, asc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import {
  conversations,
  customRequests,
  messages,
  notifications,
  productImages,
  products,
  reviews,
  users,
  vendors,
  type CustomizationOption,
} from "@/lib/db/schema";
import { requireSeller } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { OrderError, vendorOrderAction, type VendorAction } from "@/lib/commerce/orders";
import { saveUpload, saveUploads } from "@/lib/storage";
import { slugify } from "@/lib/ids";
import { sendEmail } from "@/lib/email";
import { looksLikePlaceholderText } from "@/lib/trust/visibility";

export type ActionState = { ok?: boolean; message?: string; error?: string } | null;

const rupees = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? "").replace(/[, ]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null;
};
const num = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const list = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
const files = (fd: FormData, key: string) => fd.getAll(key).filter((f): f is File => f instanceof File && f.size > 0);

// ── Orders ──────────────────────────────────────────────────────────────────

export async function sellerOrderAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireSeller();
  const vendorOrderId = String(fd.get("vendorOrderId"));
  const type = String(fd.get("type")) as VendorAction["type"];
  let action: VendorAction;
  if (type === "ship") {
    action = {
      type: "ship",
      courier: String(fd.get("courier") ?? "").trim(),
      trackingNumber: String(fd.get("trackingNumber") ?? "").trim(),
      trackingUrl: String(fd.get("trackingUrl") ?? "").trim() || null,
      packageWeightG: num(fd.get("packageWeightKg")) != null ? Math.round(num(fd.get("packageWeightKg"))! * 1000) : null,
    };
  } else if (type === "accept" || type === "start_production" || type === "ready") {
    action = { type };
  } else {
    return { error: "Unknown action" };
  }
  try {
    await vendorOrderAction(vendorOrderId, action, { userId: user.id, vendorId: user.vendorId });
  } catch (e) {
    return { error: e instanceof OrderError ? e.message : "Something went wrong. Please try again." };
  }
  refresh();
  return { ok: true, message: action.type === "ship" ? "Marked as shipped — the buyer can now track the parcel." : "Order updated." };
}

// ── Listings ────────────────────────────────────────────────────────────────

const listingSchema = z.object({
  title: z.string().trim().min(4, "Give the piece a title (at least 4 characters)").max(140),
  categoryId: z.uuid("Choose a category"),
  summary: z.string().trim().max(240).optional(),
  description: z.string().trim().max(6000).optional(),
  story: z.string().trim().max(3000).optional(),
  availability: z.enum(["ready_to_ship", "made_to_order"]),
  careInstructions: z.string().trim().max(1000).optional(),
  videoUrl: z.union([z.literal(""), z.url("Video link must be a full URL")]).optional(),
});

export async function saveListing(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireSeller();
  const parsed = listingSchema.safeParse({
    title: fd.get("title"),
    categoryId: fd.get("categoryId"),
    summary: fd.get("summary") ?? undefined,
    description: fd.get("description") ?? undefined,
    story: fd.get("story") ?? undefined,
    availability: fd.get("availability"),
    careInstructions: fd.get("careInstructions") ?? undefined,
    videoUrl: fd.get("videoUrl") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const pricePkr = rupees(fd.get("pricePkr"));
  if (!pricePkr) return { error: "Enter your price in rupees." };
  if (looksLikePlaceholderText(parsed.data.title) || looksLikePlaceholderText(parsed.data.description))
    return { error: "Please replace placeholder text with a real description." };

  let customization: CustomizationOption[] = [];
  try {
    customization = JSON.parse(String(fd.get("customizationJson") || "[]"));
    if (!Array.isArray(customization)) customization = [];
  } catch {
    return { error: "Customisation options couldn't be read." };
  }
  customization = customization
    .filter((o) => o && o.label?.trim())
    .slice(0, 8)
    .map((o, i) => ({
      id: o.id?.trim() || `opt${i + 1}`,
      label: o.label.trim().slice(0, 60),
      kind: o.kind === "select" ? "select" : "text",
      choices:
        o.kind === "select"
          ? (o.choices ?? [])
              .map((c) => c.trim())
              .filter(Boolean)
              .slice(0, 12)
          : undefined,
      required: !!o.required,
      maxLength: o.kind === "text" ? Math.min(Number(o.maxLength) || 60, 500) : undefined,
      extraPricePkr: o.extraPricePkr ? Math.round(Number(o.extraPricePkr) * 100) || undefined : undefined,
    }));

  const intent = String(fd.get("intent") ?? "draft"); // draft | submit
  const productId = String(fd.get("productId") ?? "");
  const d = await db();
  const existing = productId ? await d.query.products.findFirst({ where: and(eq(products.id, productId), eq(products.vendorId, user.vendorId)) }) : null;
  if (productId && !existing) return { error: "Listing not found." };

  const weightKg = num(fd.get("weightKg"));
  const values = {
    title: parsed.data.title,
    categoryId: parsed.data.categoryId,
    summary: parsed.data.summary || null,
    description: parsed.data.description || null,
    story: parsed.data.story || null,
    pricePkr,
    compareAtPricePkr: rupees(fd.get("compareAtPricePkr")),
    availability: parsed.data.availability,
    stockQty: Math.max(0, Math.floor(num(fd.get("stockQty")) ?? 1)),
    isOneOfAKind: fd.get("isOneOfAKind") === "on",
    timeToMakeDays: num(fd.get("timeToMakeDays")),
    dispatchDays: num(fd.get("dispatchDays")),
    widthCm: num(fd.get("widthCm"))?.toString() ?? null,
    heightCm: num(fd.get("heightCm"))?.toString() ?? null,
    depthCm: num(fd.get("depthCm"))?.toString() ?? null,
    weightG: weightKg != null ? Math.round(weightKg * 1000) : null,
    materials: list(fd.get("materials")),
    techniques: list(fd.get("techniques")),
    careInstructions: parsed.data.careInstructions || null,
    videoUrl: parsed.data.videoUrl || null,
    customizable: customization.length > 0,
    customizationOptions: customization,
    wholesaleEnabled: fd.get("wholesaleEnabled") === "on",
    wholesaleMinQty: num(fd.get("wholesaleMinQty")),
    wholesalePricePkr: rupees(fd.get("wholesalePricePkr")),
  };
  if (values.isOneOfAKind) values.stockQty = Math.min(values.stockQty, 1);

  if (intent === "submit") {
    const missing: string[] = [];
    if (!values.description || values.description.length < 60) missing.push("a description of at least 60 characters");
    if (!values.weightG) missing.push("the packed weight (needed for shipping quotes)");
    if (!values.widthCm || !values.heightCm) missing.push("dimensions");
    if (!values.materials.length) missing.push("materials");
    if (values.availability === "made_to_order" && !values.timeToMakeDays) missing.push("time to make");
    if (values.availability === "ready_to_ship" && !values.dispatchDays) missing.push("dispatch time");
    const imageCount = existing ? (await d.select().from(productImages).where(eq(productImages.productId, existing.id))).length : 0;
    if (imageCount + files(fd, "images").length === 0) missing.push("at least one photo");
    if (missing.length) return { error: `Before submitting, please add ${missing.join(", ")}.` };
  }

  let id = existing?.id;
  if (existing) {
    const status = intent === "submit" ? "pending_review" : existing.status === "active" ? "pending_review" : existing.status;
    await d
      .update(products)
      .set({ ...values, status, rejectionReason: intent === "submit" ? null : existing.rejectionReason })
      .where(eq(products.id, existing.id));
  } else {
    const base = slugify(values.title) || "piece";
    let slug = base;
    for (let i = 2; await d.query.products.findFirst({ where: eq(products.slug, slug) }); i++) slug = `${base}-${i}`;
    const vendor = await d.query.vendors.findFirst({ where: eq(vendors.id, user.vendorId) });
    const [row] = await d
      .insert(products)
      .values({ ...values, vendorId: user.vendorId, slug, region: vendor?.workshopRegion ?? null, status: intent === "submit" ? "pending_review" : "draft" })
      .returning();
    id = row.id;
  }

  const uploads = files(fd, "images");
  if (uploads.length) {
    try {
      const urls = await saveUploads(uploads.slice(0, 12), { uploadedById: user.id });
      const [{ max }] = await d
        .select({ max: sql<number>`coalesce(max(${productImages.sort}), -1)::int` })
        .from(productImages)
        .where(eq(productImages.productId, id!));
      await d.insert(productImages).values(urls.map((url, i) => ({ productId: id!, url, alt: values.title, kind: "photo" as const, sort: max + 1 + i })));
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Upload failed." };
    }
  }
  const scan = files(fd, "scan")[0];
  if (scan) {
    try {
      const url = await saveUpload(scan, { uploadedById: user.id });
      await d
        .update(products)
        .set({ model3d: { source: "scan", url } })
        .where(eq(products.id, id!));
    } catch (e) {
      return { error: e instanceof Error ? e.message : "3D scan upload failed." };
    }
  }

  if (!existing) redirect(`/seller/listings/${id}?saved=1`);
  refresh();
  return {
    ok: true,
    message:
      intent === "submit"
        ? "Submitted for review — our team usually reviews listings within two working days."
        : existing?.status === "active"
          ? "Changes saved and sent for review."
          : "Draft saved.",
  };
}

export async function deleteListingImage(fd: FormData) {
  const user = await requireSeller();
  const imageId = String(fd.get("imageId"));
  const d = await db();
  const img = await d.query.productImages.findFirst({ where: eq(productImages.id, imageId), with: { product: true } });
  if (!img || img.product.vendorId !== user.vendorId) return;
  await d.delete(productImages).where(eq(productImages.id, imageId));
  refresh();
}

export async function moveListingImage(fd: FormData) {
  const user = await requireSeller();
  const imageId = String(fd.get("imageId"));
  const dir = String(fd.get("dir")) === "up" ? -1 : 1;
  const d = await db();
  const img = await d.query.productImages.findFirst({ where: eq(productImages.id, imageId), with: { product: true } });
  if (!img || img.product.vendorId !== user.vendorId) return;
  const all = await d.select().from(productImages).where(eq(productImages.productId, img.productId)).orderBy(asc(productImages.sort));
  const i = all.findIndex((x) => x.id === imageId);
  const j = i + dir;
  if (j < 0 || j >= all.length) return;
  [all[i], all[j]] = [all[j], all[i]];
  for (const [k, x] of all.entries()) await d.update(productImages).set({ sort: k }).where(eq(productImages.id, x.id));
  refresh();
}

export async function setListingStatus(fd: FormData) {
  const user = await requireSeller();
  const id = String(fd.get("productId"));
  const to = String(fd.get("to"));
  const d = await db();
  const p = await d.query.products.findFirst({ where: and(eq(products.id, id), eq(products.vendorId, user.vendorId)) });
  if (!p) return;
  if (to === "archived") await d.update(products).set({ status: "archived" }).where(eq(products.id, id));
  if (to === "draft" && p.status === "archived") await d.update(products).set({ status: "draft" }).where(eq(products.id, id));
  refresh();
}

export async function duplicateListing(fd: FormData) {
  const user = await requireSeller();
  const id = String(fd.get("productId"));
  const d = await db();
  const p = await d.query.products.findFirst({ where: and(eq(products.id, id), eq(products.vendorId, user.vendorId)), with: { images: true } });
  if (!p) return;
  const { id: _id, createdAt: _c, updatedAt: _u, publishedAt: _p, viewCount: _v, slug: _s, ...rest } = p;
  void _id;
  void _c;
  void _u;
  void _p;
  void _v;
  void _s;
  const base = slugify(`${p.title} copy`);
  let slug = base;
  for (let i = 2; await d.query.products.findFirst({ where: eq(products.slug, slug) }); i++) slug = `${base}-${i}`;
  const { images, ...fields } = rest;
  const [copy] = await d
    .insert(products)
    .values({ ...fields, title: `${p.title} (copy)`, slug, status: "draft", isDemo: false })
    .returning();
  if (images.length) await d.insert(productImages).values(images.map((im) => ({ productId: copy.id, url: im.url, alt: im.alt, kind: im.kind, sort: im.sort })));
  redirect(`/seller/listings/${copy.id}`);
}

// ── Storefront profile ──────────────────────────────────────────────────────

const REGIONS = ["punjab", "sindh", "khyber_pakhtunkhwa", "balochistan", "gilgit_baltistan", "azad_kashmir", "islamabad"] as const;

export async function saveStorefront(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireSeller();
  const schema = z.object({
    tagline: z.string().trim().max(90).optional(),
    story: z.string().trim().min(80, "Tell buyers your story in at least 80 characters").max(3000),
    craftHistory: z.string().trim().max(3000).optional(),
    craft: z.string().trim().min(3).max(60),
    workshopCity: z.string().trim().min(2, "Add your workshop's city").max(60),
    workshopRegion: z.enum(REGIONS),
    foundedYear: z.coerce
      .number()
      .int()
      .min(1900)
      .max(new Date().getFullYear())
      .optional()
      .or(z.literal("").transform(() => undefined)),
    languages: z.string().optional(),
    storyVideoUrl: z.union([z.literal(""), z.url("Video link must be a full URL")]).optional(),
  });
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (looksLikePlaceholderText(parsed.data.story) || looksLikePlaceholderText(parsed.data.tagline))
    return { error: "Please replace placeholder text with your own words." };
  const d = await db();
  const patch: Partial<typeof vendors.$inferInsert> = {
    tagline: parsed.data.tagline || null,
    story: parsed.data.story,
    craftHistory: parsed.data.craftHistory || null,
    craft: parsed.data.craft,
    workshopCity: parsed.data.workshopCity,
    workshopRegion: parsed.data.workshopRegion,
    foundedYear: typeof parsed.data.foundedYear === "number" ? parsed.data.foundedYear : null,
    languages: list(parsed.data.languages ?? null),
    storyVideoUrl: parsed.data.storyVideoUrl || null,
    acceptsCustomOrders: fd.get("acceptsCustomOrders") === "on",
    vacationMode: fd.get("vacationMode") === "on",
  };
  const photo = files(fd, "profilePhoto")[0];
  const banner = files(fd, "banner")[0];
  try {
    if (photo) {
      patch.profilePhotoUrl = await saveUpload(photo, { uploadedById: user.id });
      patch.profilePhotoKind = "photo";
    }
    if (banner) patch.bannerUrl = await saveUpload(banner, { uploadedById: user.id });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Upload failed." };
  }
  if (patch.bannerUrl) {
    const clash = await d.query.vendors.findFirst({ where: and(eq(vendors.bannerUrl, patch.bannerUrl), ne(vendors.id, user.vendorId)) });
    if (clash) return { error: "That banner is already used by another artisan — please upload your own photo." };
  }
  await d.update(vendors).set(patch).where(eq(vendors.id, user.vendorId));
  refresh();
  return { ok: true, message: "Storefront updated." };
}

// ── Custom requests ─────────────────────────────────────────────────────────

export async function quoteCustomRequest(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireSeller();
  const id = String(fd.get("requestId"));
  const quotePkr = rupees(fd.get("quotePkr"));
  const quoteDays = num(fd.get("quoteDays"));
  const message = String(fd.get("quoteMessage") ?? "").trim();
  if (!quotePkr || !quoteDays) return { error: "Enter your price in rupees and how many days it will take." };
  const d = await db();
  const req = await d.query.customRequests.findFirst({ where: and(eq(customRequests.id, id), eq(customRequests.vendorId, user.vendorId)) });
  if (!req) return { error: "Request not found." };
  await d
    .update(customRequests)
    .set({ status: "quoted", quotePkr, quoteDays, quoteMessage: message || null, quotedAt: new Date() })
    .where(eq(customRequests.id, id));
  if (req.userId)
    await d
      .insert(notifications)
      .values({ userId: req.userId, kind: "request", title: `Your commission ${req.number} has a quote`, link: "/account/requests" });
  await sendEmail({
    to: req.email,
    subject: `A quote for your commission ${req.number}`,
    template: "request_quoted",
    body: "The artisan has sent a quote and timeline. See it in your account — prices are shown in your currency.",
  });
  refresh();
  return { ok: true, message: "Quote sent to the buyer." };
}

export async function declineCustomRequest(fd: FormData) {
  const user = await requireSeller();
  const id = String(fd.get("requestId"));
  const d = await db();
  await d
    .update(customRequests)
    .set({ status: "declined", quoteMessage: String(fd.get("reason") ?? "").trim() || null })
    .where(and(eq(customRequests.id, id), eq(customRequests.vendorId, user.vendorId)));
  refresh();
}

// ── Messages ────────────────────────────────────────────────────────────────

export async function sellerReply(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireSeller();
  const id = String(fd.get("conversationId"));
  const body = String(fd.get("body") ?? "").trim();
  if (!body) return { error: "Write a message first." };
  if (body.length > 4000) return { error: "Message is too long." };
  const d = await db();
  const c = await d.query.conversations.findFirst({ where: and(eq(conversations.id, id), eq(conversations.vendorId, user.vendorId)) });
  if (!c) return { error: "Conversation not found." };
  await d.insert(messages).values({ conversationId: id, senderUserId: user.id, body });
  await d.update(conversations).set({ lastMessageAt: new Date() }).where(eq(conversations.id, id));
  await d.insert(notifications).values({ userId: c.buyerId, kind: "message", title: "New reply from the artisan", link: `/account/messages/${id}` });
  refresh();
  return { ok: true };
}

export async function markConversationRead(conversationId: string) {
  const user = await requireSeller();
  const d = await db();
  const c = await d.query.conversations.findFirst({ where: and(eq(conversations.id, conversationId), eq(conversations.vendorId, user.vendorId)) });
  if (!c) return;
  await d
    .update(messages)
    .set({ readAt: new Date() })
    .where(and(eq(messages.conversationId, conversationId), ne(messages.senderUserId, user.id), sql`${messages.readAt} is null`));
}

// ── Reviews ─────────────────────────────────────────────────────────────────

export async function replyToReview(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireSeller();
  const id = String(fd.get("reviewId"));
  const reply = String(fd.get("reply") ?? "").trim();
  if (reply.length < 2) return { error: "Write a reply first." };
  const d = await db();
  const r = await d.query.reviews.findFirst({ where: and(eq(reviews.id, id), eq(reviews.vendorId, user.vendorId)) });
  if (!r) return { error: "Review not found." };
  await d
    .update(reviews)
    .set({ sellerReply: reply.slice(0, 1500), sellerRepliedAt: new Date() })
    .where(eq(reviews.id, id));
  refresh();
  return { ok: true, message: "Reply posted." };
}

// ── Account ─────────────────────────────────────────────────────────────────

export async function saveSellerAccount(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireSeller();
  const name = String(fd.get("name") ?? "").trim();
  const phone = String(fd.get("phone") ?? "").trim();
  const bank = String(fd.get("payoutBankName") ?? "").trim();
  const title = String(fd.get("payoutAccountTitle") ?? "").trim();
  const acct = String(fd.get("payoutAccount") ?? "").replace(/\s/g, "");
  if (name.length < 2) return { error: "Enter your name." };
  const d = await db();
  await d
    .update(users)
    .set({ name, phone: phone || null })
    .where(eq(users.id, user.id));
  const patch: Partial<typeof vendors.$inferInsert> = {
    payoutMethod: String(fd.get("payoutMethod") ?? "bank") || "bank",
    payoutBankName: bank || null,
    payoutAccountTitle: title || null,
  };
  // Only the last four digits are stored here; finance confirms full details directly.
  if (acct) patch.payoutAccountLast4 = acct.slice(-4);
  await d.update(vendors).set(patch).where(eq(vendors.id, user.vendorId));
  refresh();
  return { ok: true, message: "Account details saved." };
}

export async function changeSellerPassword(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireSeller();
  const current = String(fd.get("current") ?? "");
  const next = String(fd.get("next") ?? "");
  if (next.length < 8) return { error: "Use at least 8 characters for the new password." };
  const d = await db();
  const row = await d.query.users.findFirst({ where: eq(users.id, user.id) });
  if (!(await verifyPassword(current, row?.passwordHash))) return { error: "Your current password is incorrect." };
  await d
    .update(users)
    .set({ passwordHash: await hashPassword(next) })
    .where(eq(users.id, user.id));
  return { ok: true, message: "Password changed." };
}
