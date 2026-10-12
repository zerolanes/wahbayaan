"use server";

import { headers } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { createSession, getCurrentUser } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { sendEmail } from "@/lib/email";
import { OnboardingError, submitBrandApplication } from "@/lib/brand-portal/onboarding";
import { BRAND_SELLER_TERMS_VERSION } from "@/lib/brand-portal/terms";
import type { FormResult } from "./forms";

const strings = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string" && v.trim() !== "")) as Record<string, string>;
const firstErrors = (issues: readonly { path: PropertyKey[]; message: string }[]) => {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0])] ??= i.message;
  return out;
};

const schema = z.object({
  brandName: z.string().trim().min(2, "Enter your brand's name").max(80),
  contactName: z.string().trim().min(2, "Enter your full name").max(120),
  contactRole: z.string().trim().max(80).optional(),
  email: z.email("Enter a valid email"),
  phone: z.string().trim().min(7, "Enter a phone or WhatsApp number").max(40),
  websiteUrl: z.url("Enter a full link, starting with https://").optional(),
  instagram: z.string().trim().max(80).optional(),
  city: z.string().trim().min(2, "Which city are you based in?").max(80),
  productTypes: z.string().trim().min(2, "What do you sell?").max(300),
  catalogueSize: z.enum(["1-20", "21-100", "101-500", "500+"]).optional(),
  about: z.string().trim().min(30, "Tell us about your brand (at least 30 characters)").max(3000),
  terms: z.literal("on", { message: "Accept the brand seller terms to apply" }),
  termsVersion: z.string(),
  password: z.string().min(8, "Use at least 8 characters").max(200).optional(),
});

const AUDIENCES = ["women", "men", "kids", "unisex"] as const;

/**
 * "Sell your brand on Wahbayaan". Creates the account first when the applicant
 * is signed out (so they log in with their own password after approval), then
 * the application with the recorded, audited terms acceptance.
 */
export async function submitBrandSellerApplication(_prev: FormResult, formData: FormData): Promise<FormResult> {
  const parsed = schema.safeParse(strings(formData));
  if (!parsed.success) return { error: "Please check the highlighted fields.", fieldErrors: firstErrors(parsed.error.issues) };
  const f = parsed.data;
  const audiences = formData.getAll("audiences").filter((a): a is (typeof AUDIENCES)[number] => typeof a === "string" && (AUDIENCES as readonly string[]).includes(a));
  if (!audiences.length) return { error: "Please check the highlighted fields.", fieldErrors: { audiences: "Choose who you design for" } };
  const h = await headers();
  let user = await getCurrentUser();
  if (user?.role === "staff") return { error: "Staff accounts can't apply as a brand. Sign in with the brand's own account." };
  const d = await db();
  if (!user) {
    if (!f.password) return { error: "Please check the highlighted fields.", fieldErrors: { password: "Choose a password for your brand account" } };
    const email = f.email.toLowerCase();
    const exists = await d.query.users.findFirst({ where: eq(sql`lower(${users.email})`, email) });
    if (exists) return { error: "An account with this email already exists. Sign in first, then apply.", fieldErrors: { email: "Already registered — sign in first" } };
    const [created] = await d.insert(users).values({ email, name: f.contactName, passwordHash: await hashPassword(f.password), country: "PK", phone: f.phone }).returning();
    await createSession(created.id, h.get("user-agent"));
    user = { id: created.id } as NonNullable<typeof user>;
  }
  try {
    await submitBrandApplication({
      userId: user.id,
      brandName: f.brandName,
      contactName: f.contactName,
      contactRole: f.contactRole ?? null,
      email: f.email,
      phone: f.phone,
      websiteUrl: f.websiteUrl ?? null,
      instagram: f.instagram ?? null,
      city: f.city,
      audiences,
      productTypes: f.productTypes,
      catalogueSize: f.catalogueSize ?? null,
      about: f.about,
      termsVersion: f.termsVersion,
      ipAddress: (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null,
      userAgent: h.get("user-agent"),
    });
  } catch (e) {
    if (e instanceof OnboardingError) return { error: e.message };
    throw e;
  }
  await sendEmail({
    to: f.email,
    subject: `We've received ${f.brandName}'s application`,
    template: "brand_application",
    body: `Thank you, ${f.contactName}. We review every brand by hand and will reply within a few working days.\n\nYou accepted the Wahbayaan brand seller terms (version ${BRAND_SELLER_TERMS_VERSION}).`,
  });
  return { ok: true, message: f.brandName };
}
