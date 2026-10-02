"use server";

import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { brandProductImages, brandProducts, brandProductVariants, brands, brandSources } from "@/lib/db/schema";
import { adminAction, AdminError, files } from "@/lib/admin/action";
import { zBool, zIds, zInt, zMoney, zOptInt, zOptMoney, zOptStr, zStr, zUuid } from "@/lib/admin/zod";
import { slugify } from "@/lib/brands/adapters/normalize";
import { FIXTURE_PREFIX, fixturesAllowed } from "@/lib/brands/adapters/transport";
import { canAuthorise, canEnableSync, PARTNERSHIP_LABEL } from "@/lib/brands/permission";
import { parseSizeGuide } from "@/lib/brands/size-guide";
import { runBrandSync } from "@/lib/brands/sync";
import { saveUpload } from "@/lib/storage";

/** Paths under /brands that a brand slug must never take. */
const RESERVED = new Set(["shop", "bag", "checkout", "request", "order-placed", "art"]);

const AUDIENCES = ["women", "men", "kids", "unisex"] as const;
const zAudiences = z.preprocess((v) => (v == null ? [] : Array.isArray(v) ? v : [v]), z.array(z.enum(AUDIENCES)));

async function getBrand(id: string) {
  const d = await db();
  const b = await d.query.brands.findFirst({ where: eq(brands.id, id), with: { source: true } });
  if (!b) throw new AdminError("Brand not found");
  return b;
}

function cleanSlug(raw: string) {
  const slug = slugify(raw);
  if (!slug) throw new AdminError("Enter a name or slug.");
  if (RESERVED.has(slug)) throw new AdminError(`“${slug}” is reserved for a storefront page — choose another slug.`);
  return slug;
}

// ── Brands ──────────────────────────────────────────────────────────────────

export const createBrandAction = adminAction("brands.manage", z.object({ name: zStr(120), slug: zOptStr(80) }), async ({ data, audit }) => {
  const d = await db();
  const slug = cleanSlug(data.slug ?? data.name);
  const [b] = await d.insert(brands).values({ name: data.name, slug, isActive: false, partnership: "none" }).returning();
  await d.insert(brandSources).values({ brandId: b.id, type: "manual" });
  await audit({ action: "brand.create", entity: "brand", entityId: b.id, summary: `Created brand ${b.name} (draft, no permission)` });
  redirect(`/admin/brands/${b.id}`);
});

export const updateBrandAction = adminAction(
  "brands.manage",
  z.object({
    id: zUuid,
    name: zStr(120),
    slug: zStr(80),
    websiteUrl: zOptStr(300).refine((v) => !v || /^https?:\/\//.test(v), "Website must start with http(s)://"),
    logoUrl: zOptStr(500),
    description: zOptStr(2000),
    audiences: zAudiences,
    defaultWeightG: zOptInt(1, 70_000),
    isActive: zBool,
    sort: zInt(0, 10_000),
  }),
  async ({ data, user, formData, audit }) => {
    const before = await getBrand(data.id);
    const upload = files(formData, "logo")[0];
    const logoUrl = upload ? await saveUpload(upload, { uploadedById: user.id, alt: `${data.name} logo` }) : data.logoUrl;
    const row = {
      name: data.name,
      slug: cleanSlug(data.slug),
      websiteUrl: data.websiteUrl,
      logoUrl,
      description: data.description,
      audiences: data.audiences,
      defaultWeightG: data.defaultWeightG,
      isActive: data.isActive,
      sort: data.sort,
    };
    const d = await db();
    await d.update(brands).set(row).where(eq(brands.id, before.id));
    const changed = (Object.keys(row) as (keyof typeof row)[]).filter((k) => JSON.stringify(row[k]) !== JSON.stringify(before[k]));
    await audit({ action: "brand.update", entity: "brand", entityId: before.id, summary: `Edited brand ${row.name} (${changed.join(", ") || "no changes"})`, data: { changed } });
    return {
      message: row.isActive && before.partnership !== "authorised" ? "Saved — the brand stays private until the partnership is authorised" : "Brand saved",
    };
  },
);

/** Who granted permission, when, and a note — audited. Required before sync can be switched on or the brand authorised. */
export const recordPermissionAction = adminAction(
  "brands.permission",
  z.object({ id: zUuid, note: zStr(2000), evidenceUrl: zOptStr(500), grantedOn: zOptStr(20) }),
  async ({ data, user, audit }) => {
    const b = await getBrand(data.id);
    const when = data.grantedOn ? new Date(`${data.grantedOn}T12:00:00Z`) : new Date();
    if (Number.isNaN(when.getTime()) || when > new Date(Date.now() + 86_400_000)) throw new AdminError("Enter the date the permission was given (not in the future).");
    const d = await db();
    await d.update(brands).set({ permissionGrantedAt: when, permissionGrantedById: user.id, permissionNote: data.note, permissionEvidenceUrl: data.evidenceUrl }).where(eq(brands.id, b.id));
    await audit({
      action: "brand.permission_recorded",
      entity: "brand",
      entityId: b.id,
      summary: `Recorded permission for ${b.name}: “${data.note.slice(0, 140)}”`,
      data: { before: { at: b.permissionGrantedAt, note: b.permissionNote }, after: { at: when, by: user.id, note: data.note, evidenceUrl: data.evidenceUrl } },
    });
    return { message: "Permission recorded" };
  },
);

export const revokePermissionAction = adminAction("brands.permission", z.object({ id: zUuid, reason: zStr(1000) }), async ({ data, audit }) => {
  const b = await getBrand(data.id);
  const d = await db();
  await d
    .update(brands)
    .set({ permissionGrantedAt: null, permissionGrantedById: null, permissionNote: null, permissionEvidenceUrl: null, partnership: b.partnership === "authorised" ? "none" : b.partnership })
    .where(eq(brands.id, b.id));
  await d.update(brandSources).set({ syncEnabled: false }).where(eq(brandSources.brandId, b.id));
  await audit({
    action: "brand.permission_revoked",
    entity: "brand",
    entityId: b.id,
    summary: `Revoked permission for ${b.name} — sync switched off, catalogue hidden (${data.reason.slice(0, 140)})`,
    data: { before: { at: b.permissionGrantedAt, note: b.permissionNote, partnership: b.partnership } },
  });
  return { message: "Permission revoked — sync off and catalogue hidden" };
});

export const setPartnershipAction = adminAction(
  "brands.permission",
  z.object({ id: zUuid, partnership: z.enum(["none", "requested", "authorised"]), partnershipNote: zOptStr(2000) }),
  async ({ data, audit }) => {
    const b = await getBrand(data.id);
    if (data.partnership === "authorised") {
      const g = canAuthorise(b);
      if (!g.ok) throw new AdminError(g.reason);
    }
    const d = await db();
    await d.update(brands).set({ partnership: data.partnership, partnershipNote: data.partnershipNote }).where(eq(brands.id, b.id));
    await audit({
      action: "brand.partnership",
      entity: "brand",
      entityId: b.id,
      summary: `${b.name}: partnership ${PARTNERSHIP_LABEL[b.partnership]} → ${PARTNERSHIP_LABEL[data.partnership]}`,
      data: { before: { partnership: b.partnership }, after: { partnership: data.partnership, note: data.partnershipNote } },
    });
    return { message: data.partnership === "authorised" ? "Authorised — the catalogue goes live once the brand is switched on" : "Partnership updated" };
  },
);

// ── Source & sync ───────────────────────────────────────────────────────────

export const updateSourceAction = adminAction(
  "brands.manage",
  z.object({
    id: zUuid,
    type: z.enum(["shopify_json", "csv_feed", "manual"]),
    url: zOptStr(500),
    rateLimitMs: zInt(1000, 60_000),
    maxPages: zInt(1, 50),
    markMissingUnavailable: zBool,
  }),
  async ({ data, audit }) => {
    const b = await getBrand(data.id);
    if (data.type === "shopify_json") {
      if (!data.url) throw new AdminError("Enter the store's products.json URL.");
      if (data.url.startsWith(FIXTURE_PREFIX)) {
        if (!fixturesAllowed()) throw new AdminError("Recorded fixtures are only available in development and demo mode.");
      } else if (!/^https:\/\/[^/]+\/.*products\.json$/i.test(data.url)) throw new AdminError("Use an https URL ending in /products.json.");
    }
    const config = { url: data.type === "shopify_json" ? data.url : null, rateLimitMs: data.rateLimitMs, maxPages: data.maxPages, currency: "PKR", markMissingUnavailable: data.markMissingUnavailable };
    const d = await db();
    if (b.source) await d.update(brandSources).set({ type: data.type, config, syncEnabled: data.type === "manual" ? false : b.source.syncEnabled }).where(eq(brandSources.id, b.source.id));
    else await d.insert(brandSources).values({ brandId: b.id, type: data.type, config });
    await audit({ action: "brand.source", entity: "brand", entityId: b.id, summary: `${b.name}: source set to ${data.type}${config.url ? ` (${config.url})` : ""}`, data: { before: b.source, after: config } });
    return { message: "Source saved" };
  },
);

export const toggleSyncAction = adminAction("brands.manage", z.object({ id: zUuid }), async ({ data, audit }) => {
  const b = await getBrand(data.id);
  const on = !b.source?.syncEnabled;
  if (on) {
    const g = canEnableSync({ ...b, sourceType: b.source?.type ?? "manual" });
    if (!g.ok) throw new AdminError(g.reason);
  }
  const d = await db();
  await d.update(brandSources).set({ syncEnabled: on }).where(eq(brandSources.brandId, b.id));
  await audit({ action: on ? "brand.sync_enabled" : "brand.sync_disabled", entity: "brand", entityId: b.id, summary: `${on ? "Switched on" : "Switched off"} catalogue sync for ${b.name}` });
  return { message: on ? "Sync switched on" : "Sync switched off" };
});

function summary(r: Awaited<ReturnType<typeof runBrandSync>>) {
  if (r.status === "refused") throw new AdminError(`Sync refused: ${r.errors[0]}`);
  if (r.status === "failed" && r.added + r.updated + r.unchanged === 0) throw new AdminError(`Sync failed: ${r.errors[0] ?? "unknown error"}`);
  return `${r.added} added, ${r.updated} updated, ${r.unchanged} unchanged, ${r.failed} failed${r.markedUnavailable ? `, ${r.markedUnavailable} marked unavailable` : ""}`;
}

/** The engine itself enforces the permission gate and records the run (and its own audit entry). */
export const syncNowAction = adminAction("brands.manage", z.object({ id: zUuid }), async ({ data, user }) => {
  const r = await runBrandSync(data.id, { trigger: "admin", actorUserId: user.id });
  return { message: `Synced: ${summary(r)}. New products wait as drafts.` };
});

export const uploadFeedAction = adminAction("brands.manage", z.object({ id: zUuid }), async ({ data, user, formData }) => {
  const file = files(formData, "feed")[0];
  if (!file) throw new AdminError("Choose a CSV file.");
  if (file.size > 5 * 1024 * 1024) throw new AdminError("The feed is larger than 5 MB.");
  const r = await runBrandSync(data.id, { trigger: "upload", actorUserId: user.id, csvText: await file.text() });
  return { message: `Imported: ${summary(r)}.` };
});

// ── Size guide ──────────────────────────────────────────────────────────────

export const saveSizeGuideAction = adminAction(
  "brands.manage",
  z.object({ id: zUuid, unit: z.enum(["in", "cm"]), grid: zOptStr(10_000), note: zOptStr(500) }),
  async ({ data, audit }) => {
    const b = await getBrand(data.id);
    const parsed = parseSizeGuide(data.grid ?? "", data.unit, data.note);
    if (!parsed.ok) throw new AdminError(parsed.error);
    const guide = parsed.guide;
    const d = await db();
    await d.update(brands).set({ sizeGuide: guide }).where(eq(brands.id, b.id));
    await audit({ action: "brand.size_guide", entity: "brand", entityId: b.id, summary: `${guide ? "Updated" : "Cleared"} the size guide for ${b.name}`, data: { before: b.sizeGuide, after: guide } });
    return { message: "Size guide saved" };
  },
);

// ── Brand products ──────────────────────────────────────────────────────────

export const setBrandProductStatusAction = adminAction(
  "brands.manage",
  z
    .object({ ids: zIds, status: z.enum(["draft", "published", "hidden"]).optional(), op: z.enum(["draft", "published", "hidden"]).optional() })
    .transform((v) => ({ ids: v.ids, status: (v.status ?? v.op ?? "draft") as "draft" | "published" | "hidden" })),
  async ({ data, audit }) => {
    if (!data.ids.length) throw new AdminError("Select at least one product.");
    const d = await db();
    const rows = await d.select({ id: brandProducts.id, title: brandProducts.title, status: brandProducts.status }).from(brandProducts).where(inArray(brandProducts.id, data.ids));
    await d
      .update(brandProducts)
      .set({ status: data.status, ...(data.status === "published" ? { publishedAt: new Date() } : {}) })
      .where(inArray(brandProducts.id, data.ids));
    await audit({ action: `brand_product.${data.status}`, entity: "brand_product", entityId: rows.length === 1 ? rows[0].id : null, summary: `Set ${rows.length} brand product${rows.length === 1 ? "" : "s"} to ${data.status}: ${rows.map((r) => r.title).slice(0, 5).join(", ")}`, data: { ids: data.ids } });
    return { message: `${rows.length} product${rows.length === 1 ? "" : "s"} ${data.status === "published" ? "published" : data.status === "hidden" ? "hidden" : "moved to draft"}` };
  },
);

export const priceOverrideAction = adminAction("brands.manage", z.object({ id: zUuid, priceOverride: zOptMoney }), async ({ data, audit }) => {
  const d = await db();
  const p = await d.query.brandProducts.findFirst({ where: eq(brandProducts.id, data.id) });
  if (!p) throw new AdminError("Product not found");
  if (data.priceOverride != null && data.priceOverride <= 0) throw new AdminError("The override must be above zero — clear the field to use the brand's price.");
  await d.update(brandProducts).set({ priceOverridePkr: data.priceOverride }).where(eq(brandProducts.id, p.id));
  await audit({ action: "brand_product.price_override", entity: "brand_product", entityId: p.id, summary: `${p.title}: price override ${data.priceOverride == null ? "cleared" : `set to Rs ${data.priceOverride / 100}`}`, data: { before: p.priceOverridePkr, after: data.priceOverride } });
  return { message: data.priceOverride == null ? "Using the brand's price" : "Price override saved" };
});

const list = (v: string | null) => (v ?? "").split(/[,|\n]/).map((s) => s.trim()).filter(Boolean);

/** Manual entry for a brand whose source is "manual" — the brand's own product details, entered by staff. */
export const createManualProductAction = adminAction(
  "brands.manage",
  z.object({
    brandId: zUuid,
    title: zStr(200),
    description: zOptStr(5000),
    audience: z.enum(AUDIENCES),
    category: zOptStr(80),
    collection: zOptStr(120),
    fabric: zOptStr(80),
    sourceUrl: zOptStr(500).refine((v) => !v || /^https?:\/\//.test(v), "Product link must start with http(s)://"),
    price: zMoney,
    compareAt: zOptMoney,
    weightG: zOptInt(1, 70_000),
    sizes: zOptStr(300),
    colours: zOptStr(300),
    imageUrls: zOptStr(2000),
  }),
  async ({ data, user, formData, audit }) => {
    const b = await getBrand(data.brandId);
    if (!(data.price > 0)) throw new AdminError("Enter the brand's price.");
    const uploaded = [];
    for (const f of files(formData, "images")) uploaded.push(await saveUpload(f, { uploadedById: user.id, alt: data.title }));
    const images = [...uploaded, ...list(data.imageUrls).filter((u) => /^(https:\/\/|\/media\/|\/brand-art\/)/.test(u))];
    const d = await db();
    let slug = slugify(`${b.slug}-${data.title}`);
    if (await d.query.brandProducts.findFirst({ where: eq(brandProducts.slug, slug) })) slug = `${slug}-${Date.now().toString(36)}`;
    const [p] = await d
      .insert(brandProducts)
      .values({
        brandId: b.id,
        slug,
        title: data.title,
        description: data.description,
        audience: data.audience,
        category: data.category,
        collection: data.collection,
        fabric: data.fabric,
        sourceUrl: data.sourceUrl,
        pricePkr: data.price,
        compareAtPricePkr: data.compareAt != null && data.compareAt > data.price ? data.compareAt : null,
        weightG: data.weightG,
        status: "draft",
        sourcePublishedAt: new Date(),
        isDemo: b.isDemo,
      })
      .returning();
    if (images.length) await d.insert(brandProductImages).values(images.map((url, i) => ({ productId: p.id, url, alt: data.title, kind: "photo" as const, sort: i })));
    const sizes = list(data.sizes);
    const colours = list(data.colours);
    const combos = (sizes.length ? sizes : [null]).flatMap((s) => (colours.length ? colours : [null]).map((c) => ({ s, c })));
    await d.insert(brandProductVariants).values(combos.map((x, i) => ({ productId: p.id, size: x.s, colour: x.c, available: true, sort: i })));
    await audit({ action: "brand_product.create", entity: "brand_product", entityId: p.id, summary: `Added ${p.title} to ${b.name} (draft, ${combos.length} variant${combos.length === 1 ? "" : "s"})` });
    redirect(`/admin/brand-products?brand=${b.id}&status=draft`);
  },
);

export const setVariantAvailabilityAction = adminAction("brands.manage", z.object({ id: zUuid, available: zBool, stockQty: zOptInt(0, 100_000) }), async ({ data, audit }) => {
  const d = await db();
  const v = await d.query.brandProductVariants.findFirst({ where: eq(brandProductVariants.id, data.id) });
  if (!v) throw new AdminError("Variant not found");
  await d.update(brandProductVariants).set({ available: data.available, stockQty: data.stockQty }).where(eq(brandProductVariants.id, v.id));
  await audit({ action: "brand_variant.stock", entity: "brand_product", entityId: v.productId, summary: `Variant ${[v.size, v.colour].filter(Boolean).join(" / ") || v.sku || v.id}: ${data.available ? "available" : "unavailable"}${data.stockQty != null ? `, stock ${data.stockQty}` : ""}` });
  return { message: "Variant saved" };
});

