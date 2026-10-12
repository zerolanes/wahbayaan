"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { affiliateProducts, affiliateProgrammes } from "@/lib/db/schema";
import { adminAction, AdminError, files } from "@/lib/admin/action";
import { zBool, zOptMoney, zOptStr, zStr, zUuid } from "@/lib/admin/zod";
import { AFFILIATE_STATUSES, isHttpsUrl, validateTrackingTemplate } from "@/lib/affiliate";
import { FEED_MAX_BYTES, fetchFeedText, importAffiliateFeed } from "@/lib/affiliate-import";
import { AdapterError } from "@/lib/brands/types";

const zStatus = z.enum(AFFILIATE_STATUSES.map((s) => s.key) as [string, ...string[]]);
const zHttps = (label: string) => zOptStr(1000).refine((v) => !v || isHttpsUrl(v), `${label} must start with https://`);

const programmeFields = z.object({
  name: zStr(120),
  brandName: zStr(80),
  network: zOptStr(120),
  termsUrl: zHttps("Terms URL"),
  status: zStatus,
  notes: zOptStr(4000),
  trackingTemplate: zOptStr(1000),
  feedUrl: zHttps("Feed URL"),
});

async function load(id: string) {
  const d = await db();
  const p = await d.query.affiliateProgrammes.findFirst({ where: eq(affiliateProgrammes.id, id) });
  if (!p) throw new AdminError("Programme not found");
  return p;
}

function checkTemplate(t: string | null) {
  if (!t) return;
  const g = validateTrackingTemplate(t);
  if (!g.ok) throw new AdminError(g.reason);
}

export const createAffiliateProgrammeAction = adminAction("brands.manage", programmeFields, async ({ data, audit }) => {
  checkTemplate(data.trackingTemplate);
  const d = await db();
  const [p] = await d.insert(affiliateProgrammes).values(data).returning();
  await audit({ action: "affiliate.create", entity: "affiliate_programme", entityId: p.id, summary: `Added affiliate programme ${p.name} (${p.network ?? "no network"}) — feed display not permitted yet` });
  redirect(`/admin/affiliates/${p.id}`);
});

export const updateAffiliateProgrammeAction = adminAction("brands.manage", programmeFields.extend({ id: zUuid }), async ({ data, audit }) => {
  const before = await load(data.id);
  checkTemplate(data.trackingTemplate);
  const { id, ...row } = data;
  const d = await db();
  await d.update(affiliateProgrammes).set(row).where(eq(affiliateProgrammes.id, id));
  const changed = (Object.keys(row) as (keyof typeof row)[]).filter((k) => row[k] !== before[k]);
  await audit({ action: "affiliate.update", entity: "affiliate_programme", entityId: id, summary: `Edited ${row.name} (${changed.join(", ") || "no changes"})`, data: { before, after: row } });
  return { message: "Programme saved" };
});

/** "Terms allow displaying feed products and images" — who, when and where in the terms. Audited. */
export const setAffiliateDisplayPermissionAction = adminAction(
  "brands.permission",
  z.object({ id: zUuid, allowed: zBool, note: zOptStr(2000) }),
  async ({ data, user, audit }) => {
    const p = await load(data.id);
    const d = await db();
    if (data.allowed) {
      if (!data.note) throw new AdminError("Note where the programme's terms allow displaying feed products and images (clause, date, link).");
      await d.update(affiliateProgrammes).set({ displayAllowed: true, displayAllowedAt: new Date(), displayAllowedById: user.id, displayAllowedNote: data.note }).where(eq(affiliateProgrammes.id, p.id));
      await audit({
        action: "affiliate.display_permitted",
        entity: "affiliate_programme",
        entityId: p.id,
        summary: `${p.name}: recorded that the terms allow displaying feed products and images — “${data.note.slice(0, 140)}”`,
        data: { before: { allowed: p.displayAllowed, note: p.displayAllowedNote }, after: { allowed: true, by: user.id, note: data.note } },
      });
      return { message: "Recorded — feed products show once the programme is active" };
    }
    await d.update(affiliateProgrammes).set({ displayAllowed: false, displayAllowedAt: null, displayAllowedById: null, displayAllowedNote: null }).where(eq(affiliateProgrammes.id, p.id));
    await audit({ action: "affiliate.display_revoked", entity: "affiliate_programme", entityId: p.id, summary: `${p.name}: feed display permission removed${data.note ? ` (${data.note.slice(0, 140)})` : ""} — products hidden`, data: { before: { note: p.displayAllowedNote } } });
    return { message: "Removed — feed products are hidden" };
  },
);

function feedSummary(r: Awaited<ReturnType<typeof importAffiliateFeed>>) {
  return `${r.added} added, ${r.updated} updated, ${r.hidden} hidden${r.errors.length ? `, ${r.errors.length} rows skipped (first: row ${r.errors[0].line} — ${r.errors[0].message})` : ""}`;
}

export const uploadAffiliateFeedAction = adminAction("brands.manage", z.object({ id: zUuid }), async ({ data, user, formData }) => {
  const p = await load(data.id);
  const file = files(formData, "feed")[0];
  if (!file) throw new AdminError("Choose a CSV file.");
  if (file.size > FEED_MAX_BYTES) throw new AdminError("The feed is larger than 5 MB.");
  try {
    return { message: `Imported: ${feedSummary(await importAffiliateFeed(p.id, await file.text(), user.id, "upload"))}` };
  } catch (e) {
    if (e instanceof AdapterError) throw new AdminError(e.message);
    throw e;
  }
});

export const fetchAffiliateFeedAction = adminAction("brands.manage", z.object({ id: zUuid }), async ({ data, user }) => {
  const p = await load(data.id);
  if (!p.feedUrl) throw new AdminError("Add the programme's CSV feed URL first.");
  try {
    const text = await fetchFeedText(p.feedUrl);
    return { message: `Fetched: ${feedSummary(await importAffiliateFeed(p.id, text, user.id, "url"))}` };
  } catch (e) {
    if (e instanceof AdapterError) throw new AdminError(e.message);
    throw new AdminError(`Couldn't fetch the feed: ${e instanceof Error ? e.message : String(e)}`);
  }
});

export const addAffiliateProductAction = adminAction(
  "brands.manage",
  z.object({ id: zUuid, title: zStr(200), productUrl: zStr(1000), imageUrl: zOptStr(1000), category: zOptStr(80), price: zOptMoney }),
  async ({ data, audit }) => {
    const p = await load(data.id);
    if (!isHttpsUrl(data.productUrl)) throw new AdminError("The product link must start with https://");
    if (data.imageUrl && !isHttpsUrl(data.imageUrl)) throw new AdminError("The image link must start with https://");
    const d = await db();
    const [row] = await d
      .insert(affiliateProducts)
      .values({ programmeId: p.id, externalId: `manual:${data.productUrl}`.slice(0, 300), title: data.title, productUrl: data.productUrl, imageUrl: data.imageUrl, category: data.category, pricePkr: data.price, lastImportedAt: new Date() })
      .returning();
    await audit({ action: "affiliate.product_add", entity: "affiliate_programme", entityId: p.id, summary: `${p.name}: added ${row.title} by hand` });
    return { message: "Product added" };
  },
);

export const toggleAffiliateProductAction = adminAction("brands.manage", z.object({ id: zUuid, productId: zUuid }), async ({ data, audit }) => {
  const d = await db();
  const row = await d.query.affiliateProducts.findFirst({ where: and(eq(affiliateProducts.id, data.productId), eq(affiliateProducts.programmeId, data.id)) });
  if (!row) throw new AdminError("Product not found");
  await d.update(affiliateProducts).set({ isHidden: !row.isHidden }).where(eq(affiliateProducts.id, row.id));
  await audit({ action: row.isHidden ? "affiliate.product_show" : "affiliate.product_hide", entity: "affiliate_programme", entityId: data.id, summary: `${row.isHidden ? "Showed" : "Hid"} partner product ${row.title}` });
  return { message: row.isHidden ? "Shown" : "Hidden" };
});
