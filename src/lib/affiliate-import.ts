import "server-only";
import { and, eq, notInArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { affiliateProducts, affiliateProgrammes } from "@/lib/db/schema";
import { audit } from "@/lib/audit";
import { httpTransport } from "@/lib/brands/adapters/transport";
import type { Transport } from "@/lib/brands/adapters/shopify";
import { AdapterError } from "@/lib/brands/types";
import { isHttpsUrl, parseAffiliateFeed } from "./affiliate";

/**
 * Affiliate feed import: CSV upload or a CSV feed URL the programme provides.
 * Upserts by the feed's product id; products that vanish from a complete feed
 * are hidden (not deleted). Importing never makes anything public — display
 * still needs the recorded terms permission (see `affiliateDisplayGate`).
 */
export const FEED_MAX_BYTES = 5 * 1024 * 1024;
const USER_AGENT = "WahbayaanAffiliateFeed/1.0 (+https://wahbayaan.com)";

export async function fetchFeedText(url: string, transport: Transport = httpTransport): Promise<string> {
  if (!isHttpsUrl(url)) throw new AdapterError("The feed URL must start with https://");
  const res = await transport(url, { userAgent: USER_AGENT });
  if (res.status !== 200) throw new AdapterError(`The feed URL answered ${res.status}.`);
  if (res.body.length > FEED_MAX_BYTES) throw new AdapterError("The feed is larger than 5 MB.");
  return res.body;
}

export async function importAffiliateFeed(programmeId: string, csvText: string, actorUserId: string | null, source: "upload" | "url") {
  const d = await db();
  const programme = await d.query.affiliateProgrammes.findFirst({ where: eq(affiliateProgrammes.id, programmeId) });
  if (!programme) throw new AdapterError("Programme not found");
  const feed = parseAffiliateFeed(csvText);
  const now = new Date();
  let added = 0;
  let updated = 0;
  for (const p of feed.products) {
    const existing = await d.query.affiliateProducts.findFirst({ where: and(eq(affiliateProducts.programmeId, programmeId), eq(affiliateProducts.externalId, p.externalId)) });
    const values = { title: p.title, productUrl: p.productUrl, imageUrl: p.imageUrl, pricePkr: p.pricePkr, category: p.category, lastImportedAt: now };
    if (existing) {
      await d.update(affiliateProducts).set(values).where(eq(affiliateProducts.id, existing.id));
      updated++;
    } else {
      await d.insert(affiliateProducts).values({ programmeId, externalId: p.externalId, ...values });
      added++;
    }
  }
  let hidden = 0;
  if (feed.products.length) {
    const gone = await d
      .update(affiliateProducts)
      .set({ isHidden: true })
      .where(and(eq(affiliateProducts.programmeId, programmeId), eq(affiliateProducts.isHidden, false), notInArray(affiliateProducts.externalId, feed.products.map((p) => p.externalId))))
      .returning({ id: affiliateProducts.id });
    hidden = gone.length;
  }
  await d.update(affiliateProgrammes).set({ lastImportAt: now }).where(eq(affiliateProgrammes.id, programmeId));
  await audit({
    actorUserId,
    action: "affiliate.import",
    entity: "affiliate_programme",
    entityId: programmeId,
    summary: `${programme.name}: feed ${source === "url" ? "fetched" : "uploaded"} — ${added} added, ${updated} updated, ${hidden} hidden, ${feed.errors.length} rows skipped`,
    data: { added, updated, hidden, errors: feed.errors.slice(0, 20) },
  });
  return { added, updated, hidden, errors: feed.errors };
}
