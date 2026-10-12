import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { brandMembers, brandProfiles, brands, brandSellerApplications, brandSources, brandTermsAcceptances, users } from "@/lib/db/schema";
import { audit } from "@/lib/audit";
import { slugify } from "@/lib/brands/adapters/normalize";
import { RESERVED_BRAND_SLUGS } from "@/lib/brands/reserved";
import { BRAND_SELLER_TERMS_VERSION, permissionFromAcceptance } from "./terms";

/**
 * Brand self-signup: application (with the recorded terms acceptance) and
 * approval (account + brand + membership; the acceptance becomes the brand's
 * permission record, so the brand is authorised).
 */
export class OnboardingError extends Error {}

export type BrandApplicationInput = {
  userId: string;
  brandName: string;
  contactName: string;
  contactRole: string | null;
  email: string;
  phone: string | null;
  websiteUrl: string | null;
  instagram: string | null;
  city: string | null;
  audiences: ("women" | "men" | "kids" | "unisex")[];
  productTypes: string | null;
  catalogueSize: string | null;
  about: string | null;
  termsVersion: string;
  ipAddress: string | null;
  userAgent: string | null;
};

export async function submitBrandApplication(input: BrandApplicationInput) {
  if (input.termsVersion !== BRAND_SELLER_TERMS_VERSION) throw new OnboardingError("The terms were updated while you were filling in the form. Please review and accept them again.");
  const d = await db();
  const open = await d.query.brandSellerApplications.findFirst({
    where: and(eq(brandSellerApplications.userId, input.userId), sql`${brandSellerApplications.status} in ('submitted','in_review','more_info')`),
  });
  if (open) throw new OnboardingError("You already have an application in review. We'll email you about it.");
  if (await d.query.brandMembers.findFirst({ where: eq(brandMembers.userId, input.userId) })) throw new OnboardingError("This account already manages a brand — open your brand portal.");
  const email = input.email.trim().toLowerCase();
  const [app] = await d
    .insert(brandSellerApplications)
    .values({
      userId: input.userId,
      brandName: input.brandName,
      contactName: input.contactName,
      contactRole: input.contactRole,
      email,
      phone: input.phone,
      websiteUrl: input.websiteUrl,
      instagram: input.instagram?.replace(/^@/, "") ?? null,
      city: input.city,
      audiences: input.audiences,
      productTypes: input.productTypes,
      catalogueSize: input.catalogueSize,
      about: input.about,
    })
    .returning();
  const [acc] = await d
    .insert(brandTermsAcceptances)
    .values({ applicationId: app.id, userId: input.userId, name: input.contactName, email, termsVersion: input.termsVersion, acceptedAt: new Date(), ipAddress: input.ipAddress, userAgent: input.userAgent?.slice(0, 300) ?? null })
    .returning();
  await audit({
    actorUserId: input.userId,
    action: "brand_terms.accepted",
    entity: "brand_application",
    entityId: app.id,
    summary: `${input.contactName} <${email}> accepted the brand seller terms (${input.termsVersion}) applying for ${input.brandName}`,
    data: { acceptanceId: acc.id, termsVersion: input.termsVersion, at: acc.acceptedAt, ip: input.ipAddress },
  });
  return { application: app, acceptance: acc };
}

export function cleanBrandSlug(raw: string) {
  const slug = slugify(raw);
  if (!slug) throw new OnboardingError("Enter a brand slug.");
  if (RESERVED_BRAND_SLUGS.has(slug)) throw new OnboardingError(`“${slug}” is reserved for a storefront page — choose another slug.`);
  return slug;
}

/**
 * Approve: the applicant's account becomes a brand seller, a brand is created
 * (or an existing unclaimed draft brand with that slug is linked), and the
 * terms acceptance is applied as the brand's permission → `authorised`.
 */
export async function approveBrandApplication(input: { applicationId: string; slug: string; brandName: string; reviewerId: string }) {
  const d = await db();
  const app = await d.query.brandSellerApplications.findFirst({ where: eq(brandSellerApplications.id, input.applicationId) });
  if (!app) throw new OnboardingError("Application not found.");
  if (app.status === "approved") throw new OnboardingError("Already approved.");
  if (app.status === "rejected") throw new OnboardingError("This application was rejected.");
  if (!app.userId) throw new OnboardingError("The application has no account linked.");
  const account = await d.query.users.findFirst({ where: eq(users.id, app.userId) });
  if (!account) throw new OnboardingError("The applicant's account no longer exists.");
  if (account.role === "staff") throw new OnboardingError("That account is a staff account.");
  if (await d.query.brandMembers.findFirst({ where: eq(brandMembers.userId, account.id) })) throw new OnboardingError("This account already manages a brand.");
  const acceptance = await d.query.brandTermsAcceptances.findFirst({ where: and(eq(brandTermsAcceptances.applicationId, app.id), isNull(brandTermsAcceptances.brandId)) });
  const permission = permissionFromAcceptance(acceptance ? { ...acceptance, userId: acceptance.userId ?? account.id } : null, { evidenceUrl: `/admin/applications/brand/${app.id}` });
  if (!permission.ok) throw new OnboardingError(`Can't authorise this brand: ${permission.reason}`);

  const slug = cleanBrandSlug(input.slug);
  return d.transaction(async (tx) => {
    let brand = await tx.query.brands.findFirst({ where: eq(brands.slug, slug) });
    let claimed = false;
    if (brand) {
      const members = await tx.select({ id: brandMembers.id }).from(brandMembers).where(eq(brandMembers.brandId, brand.id));
      if (members.length || brand.partnership === "authorised")
        throw new OnboardingError(`A brand with the slug “${slug}” is already live or managed by another account. Choose another slug.`);
      claimed = true;
    }
    const fields = {
      name: input.brandName,
      websiteUrl: app.websiteUrl,
      description: brand?.description ?? (app.about ? app.about.split(/\n/)[0].slice(0, 300) : null),
      audiences: app.audiences.length ? app.audiences : (brand?.audiences ?? []),
      isActive: true,
      partnershipNote: `Self-listed via /brands/join (application ${app.id}).`,
      ...permission.patch,
    };
    if (brand) [brand] = await tx.update(brands).set(fields).where(eq(brands.id, brand.id)).returning();
    else [brand] = await tx.insert(brands).values({ slug, ...fields }).returning();
    const source = await tx.query.brandSources.findFirst({ where: eq(brandSources.brandId, brand.id) });
    if (!source) await tx.insert(brandSources).values({ brandId: brand.id, type: "manual", syncEnabled: false });
    await tx.insert(brandMembers).values({ brandId: brand.id, userId: account.id, role: "owner" });
    await tx
      .insert(brandProfiles)
      .values({ brandId: brand.id, selfListed: true, socials: app.instagram ? { instagram: `https://instagram.com/${app.instagram}` } : {} })
      .onConflictDoUpdate({ target: brandProfiles.brandId, set: { selfListed: true } });
    if (account.role !== "seller") await tx.update(users).set({ role: "seller" }).where(eq(users.id, account.id));
    await tx.update(brandTermsAcceptances).set({ brandId: brand.id, userId: acceptance!.userId ?? account.id }).where(eq(brandTermsAcceptances.id, acceptance!.id));
    await tx.update(brandSellerApplications).set({ status: "approved", decidedAt: new Date(), reviewerId: input.reviewerId, brandId: brand.id }).where(eq(brandSellerApplications.id, app.id));
    return { brand, account, claimed, application: app, acceptance: acceptance! };
  });
}
