import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { brandMembers, brands } from "@/lib/db/schema";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";

/** The brand an account manages in the brand portal, if any. */
export const getBrandMembership = cache(async (userId: string) => {
  const d = await db();
  const m = await d.query.brandMembers.findFirst({ where: eq(brandMembers.userId, userId) });
  if (!m) return null;
  const brand = await d.query.brands.findFirst({ where: eq(brands.id, m.brandId) });
  return brand ? { member: m, brand } : null;
});

export type BrandPortalUser = CurrentUser & { brandId: string; brand: typeof brands.$inferSelect };

/**
 * Brand portal pages and actions. Every query in the portal is scoped by the
 * returned `brandId`; actions call this again rather than trusting the form.
 */
export async function requireBrandMember(next = "/brand-portal"): Promise<BrandPortalUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  const m = await getBrandMembership(user.id);
  if (!m) redirect("/brands/join");
  return { ...user, brandId: m.brand.id, brand: m.brand };
}

/** For server actions: throws instead of redirecting. */
export async function assertBrandMember(): Promise<BrandPortalUser> {
  const user = await getCurrentUser();
  if (!user) throw new BrandPortalError("Please sign in again.");
  const m = await getBrandMembership(user.id);
  if (!m) throw new BrandPortalError("This account doesn't manage a brand.");
  return { ...user, brandId: m.brand.id, brand: m.brand };
}

/** A message safe to show to the brand as-is. */
export class BrandPortalError extends Error {}
