import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { and, asc, desc, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  announcements,
  certificates,
  collectionProducts,
  collections,
  faqs,
  journalPosts,
  pages,
  products,
  reviews,
  verificationChecks,
} from "@/lib/db/schema";
import { isDemoMode } from "@/lib/settings";
import { COMPARE_COOKIE, parseCompareCookie } from "@/lib/compare";
import {
  getPublicCategories,
  getPublicProducts,
  getPublicVendorIds,
  getPublicVendors,
  type ProductCardData,
} from "./catalog";

/**
 * Storefront reads beyond the core catalogue. Anything that reaches a buyer is
 * filtered through the catalogue guards (public artisans, categories and
 * listings) and demo rows are hidden unless demo mode is on.
 */

const demoOk = <T extends { isDemo: boolean }>(row: T) => !row.isDemo || isDemoMode();

/** Public listings by id, in the order given. Ids that aren't public are dropped. */
export async function getPublicProductsByIds(ids: string[]): Promise<ProductCardData[]> {
  if (!ids.length) return [];
  const { items } = await getPublicProducts({ ids, limit: ids.length });
  return ids.map((id) => items.find((p) => p.id === id)).filter((p): p is ProductCardData => !!p);
}

export const getCompareIds = cache(async () => {
  const jar = await cookies();
  return parseCompareCookie(jar.get(COMPARE_COOKIE)?.value);
});

// ── Artisans ────────────────────────────────────────────────────────────────

export async function getPassedChecks(vendorId: string) {
  const d = await db();
  return d
    .select()
    .from(verificationChecks)
    .where(and(eq(verificationChecks.vendorId, vendorId), eq(verificationChecks.status, "passed")))
    .orderBy(asc(verificationChecks.checkedAt));
}

export const VERIFICATION_LABELS: Record<string, { title: string; text: string }> = {
  identity: { title: "Identity confirmed", text: "Government ID matched to the artisan named on the profile." },
  workshop: { title: "Workshop verified", text: "The workshop exists where the profile says it does." },
  samples: { title: "Sample work reviewed", text: "Our team inspected finished pieces for quality and honesty of description." },
  video_call: { title: "Video call held", text: "A live walk-through of the workshop, tools and work in progress." },
  address: { title: "Address confirmed", text: "Pick-up address checked for export collection." },
};

/** Artisans who work in a craft: primary category, or at least one active listing in it. */
export async function getArtisansForCategory(categoryId: string) {
  const [vendors, d] = await Promise.all([getPublicVendors(), db()]);
  const rows = await d.selectDistinct({ vendorId: products.vendorId }).from(products).where(and(eq(products.categoryId, categoryId), eq(products.status, "active")));
  const withListings = new Set(rows.map((r) => r.vendorId));
  return vendors.filter((v) => v.primaryCategoryId === categoryId || withListings.has(v.id));
}

/** Published reviews across an artisan's listings, with photos and the piece they're about. */
export async function getVendorReviews(vendorId: string, limit = 12) {
  const d = await db();
  const rows = await d.query.reviews.findMany({
    where: and(eq(reviews.vendorId, vendorId), eq(reviews.status, "published")),
    with: { photos: true, product: { columns: { slug: true, title: true, status: true } } },
    orderBy: desc(reviews.createdAt),
    limit,
  });
  return rows.filter(demoOk);
}

export async function getVendorRatingHistogram(vendorId: string) {
  const d = await db();
  const rows = await d
    .select({ rating: reviews.rating, n: sql<number>`count(*)::int` })
    .from(reviews)
    .where(and(eq(reviews.vendorId, vendorId), eq(reviews.status, "published")))
    .groupBy(reviews.rating);
  return [5, 4, 3, 2, 1].map((stars) => ({ stars, count: rows.find((r) => r.rating === stars)?.n ?? 0 }));
}

// ── Collections & bundles ───────────────────────────────────────────────────

export type PublicCollection = typeof collections.$inferSelect & { products: ProductCardData[] };

export const getPublicCollections = cache(async (): Promise<PublicCollection[]> => {
  const d = await db();
  const rows = await d.query.collections.findMany({
    where: eq(collections.isPublished, true),
    with: { products: { orderBy: asc(collectionProducts.sort) } },
    orderBy: [asc(collections.sort), asc(collections.title)],
  });
  const visible = rows.filter(demoOk);
  const allIds = [...new Set(visible.flatMap((c) => c.products.map((p) => p.productId)))];
  const cards = await getPublicProductsByIds(allIds);
  return visible
    .map(({ products: links, ...c }) => ({
      ...c,
      products: links.map((l) => cards.find((p) => p.id === l.productId)).filter((p): p is ProductCardData => !!p),
    }))
    .filter((c) => c.products.length > 0);
});

export async function getPublicCollection(slug: string) {
  return (await getPublicCollections()).find((c) => c.slug === slug) ?? null;
}

// ── Journal & content ───────────────────────────────────────────────────────

/** Published and not scheduled for later (a future `publishedAt` means scheduled). */
export function journalPostLive() {
  return and(eq(journalPosts.status, "published"), or(isNull(journalPosts.publishedAt), lte(journalPosts.publishedAt, sql`now()`)));
}

/** The site banner: the newest switched-on announcement inside its date window. */
export const getActiveAnnouncement = cache(async () => {
  const d = await db();
  const [row] = await d
    .select()
    .from(announcements)
    .where(
      and(
        eq(announcements.isActive, true),
        or(isNull(announcements.startsAt), lte(announcements.startsAt, sql`now()`)),
        or(isNull(announcements.endsAt), gt(announcements.endsAt, sql`now()`)),
      ),
    )
    .orderBy(desc(announcements.createdAt))
    .limit(1);
  return row ?? null;
});

export type JournalCard = typeof journalPosts.$inferSelect & { categoryName: string | null; categorySlug: string | null };

export const getJournalPosts = cache(async (): Promise<JournalCard[]> => {
  const d = await db();
  const [rows, cats] = await Promise.all([
    d.select().from(journalPosts).where(journalPostLive()).orderBy(desc(journalPosts.publishedAt)),
    getPublicCategories(),
  ]);
  return rows.filter(demoOk).map((p) => {
    const c = cats.find((x) => x.id === p.categoryId);
    return { ...p, categoryName: c?.name ?? null, categorySlug: c?.slug ?? null };
  });
});

export async function getJournalPost(slug: string) {
  return (await getJournalPosts()).find((p) => p.slug === slug) ?? null;
}

export async function getFaqGroups() {
  const d = await db();
  const rows = await d.select().from(faqs).where(eq(faqs.isPublished, true)).orderBy(asc(faqs.sort));
  const groups = new Map<string, typeof rows>();
  for (const r of rows) groups.set(r.group, [...(groups.get(r.group) ?? []), r]);
  return [...groups].map(([group, items]) => ({ group, items }));
}

export async function getPublishedPage(slug: string) {
  const d = await db();
  const page = await d.query.pages.findFirst({ where: eq(pages.slug, slug) });
  return page && page.status === "published" ? page : null;
}

// ── Certificates ────────────────────────────────────────────────────────────

export async function getCertificate(code: string) {
  const d = await db();
  const cert = await d.query.certificates.findFirst({ where: eq(sql`upper(${certificates.code})`, code.trim().toUpperCase()) });
  if (!cert) return null;
  const publicIds = await getPublicVendorIds();
  const vendors = publicIds.has(cert.vendorId) ? await getPublicVendors() : [];
  const vendor = vendors.find((v) => v.id === cert.vendorId) ?? null;
  const product = cert.productId ? (await getPublicProductsByIds([cert.productId]))[0] ?? null : null;
  return { ...cert, vendorSlug: vendor?.slug ?? null, vendorPhoto: vendor?.profilePhotoUrl ?? null, product };
}

// ── Drops ───────────────────────────────────────────────────────────────────

export async function getDrops() {
  const { items } = await getPublicProducts({ limitedDrops: true, limit: 100, sort: "newest" });
  const now = Date.now();
  const upcoming = items.filter((p) => p.dropStartsAt && p.dropStartsAt.getTime() > now).sort((a, b) => a.dropStartsAt!.getTime() - b.dropStartsAt!.getTime());
  const live = items.filter((p) => !p.dropStartsAt || p.dropStartsAt.getTime() <= now);
  return { upcoming, live };
}

/** Physical details for the comparison table. Pass ids already checked by `getPublicProductsByIds`. */
export async function getCompareDetails(ids: string[]) {
  if (!ids.length) return new Map<string, { widthCm: string | null; heightCm: string | null; depthCm: string | null; weightG: number | null; dispatchDays: number | null; techniques: string[] }>();
  const d = await db();
  const rows = await d
    .select({ id: products.id, widthCm: products.widthCm, heightCm: products.heightCm, depthCm: products.depthCm, weightG: products.weightG, dispatchDays: products.dispatchDays, techniques: products.techniques })
    .from(products)
    .where(inArray(products.id, ids));
  return new Map(rows.map(({ id, ...r }) => [id, r]));
}

/** Edition sizes aren't on the card type; fetch them for a handful of drops. */
export async function getEditionSizes(ids: string[]) {
  if (!ids.length) return new Map<string, number | null>();
  const d = await db();
  const rows = await d.select({ id: products.id, editionSize: products.editionSize }).from(products).where(inArray(products.id, ids));
  return new Map(rows.map((r) => [r.id, r.editionSize]));
}
