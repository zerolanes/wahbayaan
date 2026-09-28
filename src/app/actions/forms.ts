"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { categories, contactMessages, customRequests, notifications, products, vendorApplications, vendors, wholesaleApplications } from "@/lib/db/schema";
import { getCurrentUser } from "@/lib/auth/session";
import { getBuyerContext } from "@/lib/buyer-context";
import { sendEmail } from "@/lib/email";
import { reference } from "@/lib/ids";
import { isDestination } from "@/lib/money/currency";
import { getPublicCategories, getPublicVendors } from "@/lib/queries/catalog";
import { saveUploads } from "@/lib/storage";
import { REGION_LABELS } from "@/lib/utils/format";
import { CONTACT_TOPICS } from "@/lib/forms-data";

export type FormResult = { ok?: boolean; error?: string; message?: string; fieldErrors?: Record<string, string> } | null;

const strings = (formData: FormData) => Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string" && v.trim() !== "")) as Record<string, string>;
const firstErrors = (issues: readonly { path: PropertyKey[]; message: string }[]) => {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0])] ??= i.message;
  return out;
};
const files = (formData: FormData, name: string) => formData.getAll(name).filter((f): f is File => f instanceof File && f.size > 0);

// ── Commission request ──────────────────────────────────────────────────────

const customSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(120),
  email: z.email("Please enter a valid email"),
  categoryId: z.string().optional(),
  vendorSlug: z.string().optional(),
  productSlug: z.string().optional(),
  details: z.string().trim().min(30, "Describe the piece in a little more detail (at least 30 characters)").max(5000),
  customText: z.string().trim().max(300).optional(),
  sizeNotes: z.string().trim().max(200).optional(),
  colorNotes: z.string().trim().max(200).optional(),
  budget: z.coerce.number().positive("Budget must be a positive amount").max(1_000_000).optional(),
  destination: z.string().refine(isDestination, "Choose where it will be delivered"),
});

export async function submitCustomRequest(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const parsed = customSchema.safeParse(strings(formData));
  if (!parsed.success) return { error: "Please check the highlighted fields.", fieldErrors: firstErrors(parsed.error.issues) };
  const f = parsed.data;
  const [user, ctx, cats, vendorsList] = await Promise.all([getCurrentUser(), getBuyerContext(), getPublicCategories(), getPublicVendors()]);
  const vendor = f.vendorSlug ? vendorsList.find((v) => v.slug === f.vendorSlug && v.acceptsCustomOrders && !v.vacationMode) : undefined;
  const category = cats.find((c) => c.id === f.categoryId) ?? (vendor ? cats.find((c) => c.id === vendor.primaryCategoryId) : undefined);
  if (!category && !vendor) return { error: "Choose a craft or an artisan.", fieldErrors: { categoryId: "Choose a craft" } };
  const refs = files(formData, "references");
  if (refs.length > 6) return { error: "Please add up to 6 reference images." };
  let referenceImageUrls: string[] = [];
  try {
    referenceImageUrls = await saveUploads(refs, { uploadedById: user?.id ?? null });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't upload those images." };
  }
  const d = await db();
  const product = f.productSlug ? await d.query.products.findFirst({ where: eq(products.slug, f.productSlug) }) : null;
  const number = reference("REQ");
  await d.insert(customRequests).values({
    number,
    userId: user?.id ?? null,
    name: f.name,
    email: f.email.toLowerCase(),
    vendorId: vendor?.id ?? null,
    productId: product && product.status === "active" ? product.id : null,
    categoryId: category?.id ?? null,
    details: f.details,
    customText: f.customText ?? null,
    sizeNotes: f.sizeNotes ?? null,
    colorNotes: f.colorNotes ?? null,
    budget: f.budget != null ? Math.round(f.budget * 100) : null,
    budgetCurrency: f.budget != null ? ctx.currency : null,
    referenceImageUrls,
    destinationCountry: f.destination,
    status: "new",
  });
  if (vendor) {
    const v = await d.query.vendors.findFirst({ where: eq(vendors.id, vendor.id) });
    if (v) await d.insert(notifications).values({ userId: v.userId, kind: "custom_request", title: `New commission request ${number}`, link: "/seller/requests" });
  }
  await sendEmail({
    to: f.email,
    subject: `We've received your commission request ${number}`,
    template: "custom_request",
    body: `Thank you, ${f.name}. ${vendor ? `${vendor.displayName} will` : "We'll match you with a verified artisan who can"} review your request and reply with a quote and a making time. Nothing is charged until you accept.`,
  });
  redirect(`/custom/confirmation?ref=${number}${vendor ? `&artisan=${vendor.slug}` : ""}`);
}

// ── Contact ─────────────────────────────────────────────────────────────────


const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(120),
  email: z.email("Please enter a valid email"),
  topic: z.enum(CONTACT_TOPICS.map((t) => t.id) as [string, ...string[]], { message: "Choose a topic" }),
  orderNumber: z.string().trim().max(30).optional(),
  message: z.string().trim().min(10, "Please write a little more").max(5000),
});

export async function submitContact(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const parsed = contactSchema.safeParse(strings(formData));
  if (!parsed.success) return { error: "Please check the highlighted fields.", fieldErrors: firstErrors(parsed.error.issues) };
  const d = await db();
  const f = parsed.data;
  await d.insert(contactMessages).values({
    name: f.name,
    email: f.email.toLowerCase(),
    topic: CONTACT_TOPICS.find((t) => t.id === f.topic)!.label,
    orderNumber: f.orderNumber?.toUpperCase() ?? null,
    message: f.message,
  });
  return { ok: true, message: `Thank you, ${f.name.split(/\s+/)[0]}. We've got your message and will reply to ${f.email}.` };
}

// ── Artisan application ─────────────────────────────────────────────────────

const applicationSchema = z.object({
  fullName: z.string().trim().min(2, "Please enter your full name").max(120),
  email: z.email("Please enter a valid email"),
  phone: z.string().trim().min(7, "Enter a phone or WhatsApp number").max(40),
  craft: z.string().trim().min(2, "What do you make?").max(120),
  categoryId: z.string().optional(),
  workshopCity: z.string().trim().min(2, "Where is your workshop?").max(120),
  workshopRegion: z.string().refine((r) => r in REGION_LABELS, "Choose your province or region"),
  yearsPracticing: z.coerce.number().int().min(0).max(90).optional(),
  portfolioUrl: z.url("Enter a full link, starting with https://").optional(),
  instagram: z.string().trim().max(80).optional(),
  videoUrl: z.url("Enter a full link, starting with https://").optional(),
  story: z.string().trim().min(40, "Tell us a little about your craft and workshop (at least 40 characters)").max(5000),
  exportedBefore: z.string().optional(),
});

export async function submitVendorApplication(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const parsed = applicationSchema.safeParse(strings(formData));
  if (!parsed.success) return { error: "Please check the highlighted fields.", fieldErrors: firstErrors(parsed.error.issues) };
  const f = parsed.data;
  const photos = files(formData, "samples");
  if (photos.length < 1) return { error: "Please add at least one photo of your work.", fieldErrors: { samples: "Add 1–8 photos of finished pieces" } };
  if (photos.length > 8) return { error: "Please add up to 8 photos.", fieldErrors: { samples: "Up to 8 photos" } };
  const user = await getCurrentUser();
  let samplePhotoUrls: string[] = [];
  try {
    samplePhotoUrls = await saveUploads(photos, { uploadedById: user?.id ?? null });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Couldn't upload those photos.", fieldErrors: { samples: "Use JPG, PNG or WebP under 10 MB" } };
  }
  const d = await db();
  const category = f.categoryId ? await d.query.categories.findFirst({ where: eq(categories.id, f.categoryId) }) : null;
  await d.insert(vendorApplications).values({
    userId: user?.id ?? null,
    fullName: f.fullName,
    email: f.email.toLowerCase(),
    phone: f.phone,
    craft: f.craft,
    categoryId: category?.id ?? null,
    workshopCity: f.workshopCity,
    workshopRegion: f.workshopRegion as NonNullable<(typeof vendorApplications.$inferInsert)["workshopRegion"]>,
    yearsPracticing: f.yearsPracticing ?? null,
    portfolioUrl: f.portfolioUrl ?? null,
    instagram: f.instagram?.replace(/^@/, "") ?? null,
    samplePhotoUrls,
    videoUrl: f.videoUrl ?? null,
    story: f.story,
    exportedBefore: f.exportedBefore === "on",
  });
  await sendEmail({
    to: f.email,
    subject: "Your Wahbayaan application",
    template: "vendor_application",
    body: `Thank you, ${f.fullName}. Our artisan team will review your work and contact you on ${f.phone} or by email about the next step — a short video call and a workshop check.`,
  });
  return { ok: true, message: f.fullName };
}

// ── Wholesale ───────────────────────────────────────────────────────────────

const wholesaleSchema = z.object({
  businessName: z.string().trim().min(2, "Enter your business name").max(160),
  contactName: z.string().trim().min(2, "Enter your name").max(120),
  email: z.email("Please enter a valid email"),
  country: z.string().refine(isDestination, "We currently serve the US, UK and Canada"),
  website: z.url("Enter a full link, starting with https://").optional(),
  businessType: z.enum(["interior_designer", "retailer", "hospitality", "architect", "corporate_gifting", "other"], { message: "Choose your business type" }),
  expectedVolume: z.string().trim().max(120).optional(),
  message: z.string().trim().max(3000).optional(),
});

export async function submitWholesale(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const parsed = wholesaleSchema.safeParse(strings(formData));
  if (!parsed.success) return { error: "Please check the highlighted fields.", fieldErrors: firstErrors(parsed.error.issues) };
  const d = await db();
  const f = parsed.data;
  await d.insert(wholesaleApplications).values({ ...f, email: f.email.toLowerCase(), website: f.website ?? null, expectedVolume: f.expectedVolume ?? null, message: f.message ?? null });
  return { ok: true, message: `Thank you — we'll be in touch with ${f.businessName} within a few working days.` };
}
