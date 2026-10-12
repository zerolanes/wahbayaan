import "server-only";
import { cache } from "react";
import { asc, desc, inArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { affiliateProducts, affiliateProgrammes } from "@/lib/db/schema";
import { affiliateDisplayGate, buildTrackingLink, isAffiliateProductDisplayable } from "@/lib/affiliate";
import { isDemoMode } from "@/lib/settings";

export type PartnerLinkCard = { id: string; title: string; imageUrl: string; brandName: string; category: string | null; href: string };

/**
 * Partner-link cards for the storefront: only programmes whose terms permission
 * is recorded and that are active, only displayable products, each linking out
 * through the programme's tracking link. Never part of the Wahbayaan cart.
 */
export const getPartnerLinkCards = cache(async (limit = 24): Promise<PartnerLinkCard[]> => {
  const d = await db();
  const demo = isDemoMode();
  const programmes = (await d.select().from(affiliateProgrammes).orderBy(asc(affiliateProgrammes.brandName))).filter((p) => (demo || !p.isDemo) && affiliateDisplayGate(p).ok);
  if (!programmes.length) return [];
  const rows = await d
    .select()
    .from(affiliateProducts)
    .where(inArray(affiliateProducts.programmeId, programmes.map((p) => p.id)))
    .orderBy(desc(affiliateProducts.lastImportedAt), asc(affiliateProducts.title));
  const out: PartnerLinkCard[] = [];
  for (const r of rows) {
    const programme = programmes.find((p) => p.id === r.programmeId)!;
    if (!isAffiliateProductDisplayable(programme, r)) continue;
    const href = buildTrackingLink(programme.trackingTemplate, r.productUrl);
    if (!href) continue;
    out.push({ id: r.id, title: r.title, imageUrl: r.imageUrl!, brandName: programme.brandName, category: r.category, href });
    if (out.length >= limit) break;
  }
  return out;
});
