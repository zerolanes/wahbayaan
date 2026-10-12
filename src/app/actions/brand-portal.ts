"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { refresh } from "next/cache";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { brandCollections, brandProductImages, brandProducts, brandProductVariants, brandProfiles, brands } from "@/lib/db/schema";
import { audit } from "@/lib/audit";
import { saveUpload } from "@/lib/storage";
import { assertBrandMember, BrandPortalError } from "@/lib/brand-portal/access";
import { previewBrandImport, refreshProductPrice, runBrandImport, type ImportPreview } from "@/lib/brand-portal/import";
import { BRAND_CSV_MAX_BYTES } from "@/lib/brand-portal/csv";
import { markBrandItemsReady } from "@/lib/brand-portal/fulfil";
import { slugify } from "@/lib/brands/adapters/normalize";
import { parseSizeGuide } from "@/lib/brands/size-guide";
import { queueBrandAlerts } from "@/lib/brands/alerts";
import { brandProductIssues, looksLikePlaceholderText } from "@/lib/trust/visibility";
import { parseSocialLinks, SOCIAL_KEYS } from "@/lib/social";
import { isDemoMode } from "@/lib/settings";

/**
 * Brand portal mutations. Every action re-checks the signed-in account's brand
 * (`assertBrandMember`) and scopes every query by that brand id. Amounts are PKR.
 */
export type PortalState = { ok?: boolean; message?: string; error?: string } | null;

const AUDIENCES = ["women", "men", "kids", "unisex"] as const;
const STATUSES = ["draft", "published", "hidden"] as const;

const files = (fd: FormData, key: string) => fd.getAll(key).filter((f): f is File => typeof f === "object" && f !== null && "size" in f && (f as File).size > 0);
const text = (fd: FormData, key: string, max = 5000) => {
  const v = fd.get(key);
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : null;
};
/** "3,490" / "3490.50" rupees → paisa; null when blank; NaN when invalid. */
const rupees = (v: string | null) => {
  if (!v) return null;
  const n = Number(v.replace(/[,\s]|Rs\.?|PKR/gi, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : Number.NaN;
};

async function run(fn: () => Promise<PortalState | void>): Promise<PortalState> {
  try {
    const r = await fn();
    refresh();
    return { ok: true, message: "Saved", ...(r ?? {}) };
  } catch (e) {
    if (e instanceof BrandPortalError) return { error: e.message };
    unstable_rethrow(e);
    console.error("[brand portal]", e);
    const code = (e as { code?: string; cause?: { code?: string } })?.code ?? (e as { cause?: { code?: string } })?.cause?.code;
    if (code === "23505") return { error: "That value is already used — it must be unique." };
    return { error: e instanceof Error && !/sql|query|relation|column/i.test(e.message) ? e.message : "Something went wrong. Please try again." };
  }
}

async function ownProduct(brandId: string, productId: string) {
  const d = await db();
  const p = await d.query.brandProducts.findFirst({ where: and(eq(brandProducts.id, productId), eq(brandProducts.brandId, brandId)) });
  if (!p) throw new BrandPortalError("Product not found.");
  return p;
}

async function uniqueSlug(base: string) {
  const d = await db();
  const root = slugify(base) || "item";
  for (let i = 1; i < 60; i++) {
    const slug = i === 1 ? root : `${root}-${i}`;
    if (!(await d.query.brandProducts.findFirst({ where: eq(brandProducts.slug, slug), columns: { id: true } }))) return slug;
  }
  return `${root}-${Date.now().toString(36)}`;
}

const productSchema = z.object({
  title: z.string().trim().min(3, "Give the product a title (at least 3 characters)").max(200),
  description: z.string().trim().max(5000).nullable(),
  audience: z.enum(AUDIENCES, { message: "Choose who it's for" }),
  category: z.string().trim().max(120).nullable(),
  collection: z.string().trim().max(120).nullable(),
  fabric: z.string().trim().max(120).nullable(),
  tags: z.string().trim().max(500).nullable(),
  weightG: z.number().int().min(1).max(70_000).nullable(),
});

function readProduct(fd: FormData) {
  const weight = text(fd, "weightG");
  const parsed = productSchema.safeParse({
    title: text(fd, "title", 200) ?? "",
    description: text(fd, "description"),
    audience: text(fd, "audience"),
    category: text(fd, "category", 120),
    collection: text(fd, "collection", 120),
    fabric: text(fd, "fabric", 120),
    tags: text(fd, "tags", 500),
    weightG: weight ? Number(weight) : null,
  });
  if (!parsed.success) throw new BrandPortalError(parsed.error.issues[0].message);
  const p = parsed.data;
  if (looksLikePlaceholderText(p.title) || looksLikePlaceholderText(p.description)) throw new BrandPortalError("Replace placeholder text (e.g. “lorem ipsum”, “test”) before saving.");
  return { ...p, tags: (p.tags ?? "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 30) };
}

async function checkCollection(brandId: string, name: string | null) {
  if (!name) return null;
  const d = await db();
  const c = await d.query.brandCollections.findFirst({ where: and(eq(brandCollections.brandId, brandId), eq(brandCollections.name, name)) });
  if (!c) throw new BrandPortalError("Choose one of your collections (add it under Collections first).");
  return c.name;
}

// ── Products ────────────────────────────────────────────────────────────────

/** New product: details plus sizes × colours at one price; edit each variant afterwards. */
export async function createPortalProduct(_prev: PortalState, fd: FormData): Promise<PortalState> {
  let id = "";
  const r = await run(async () => {
    const user = await assertBrandMember();
    const p = readProduct(fd);
    const collection = await checkCollection(user.brandId, p.collection);
    const price = rupees(text(fd, "price"));
    if (price == null || Number.isNaN(price)) throw new BrandPortalError("Enter the price in rupees.");
    const split = (k: string) => (text(fd, k, 500) ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 20);
    const sizes = split("sizes");
    const colours = split("colours");
    const stockText = text(fd, "stock");
    const stock = stockText == null ? null : Number(stockText);
    if (stock != null && (!Number.isInteger(stock) || stock < 0)) throw new BrandPortalError("Stock per variant must be a whole number.");
    const d = await db();
    const [row] = await d
      .insert(brandProducts)
      .values({ brandId: user.brandId, slug: await uniqueSlug(`${user.brand.slug}-${p.title}`), ...p, collection, pricePkr: price, status: "draft", sourcePublishedAt: new Date(), isDemo: user.brand.isDemo })
      .returning();
    const combos = (sizes.length ? sizes : [null]).flatMap((s) => (colours.length ? colours : [null]).map((c) => ({ s, c })));
    const skuBase = slugify(p.title).toUpperCase().slice(0, 24);
    await d.insert(brandProductVariants).values(
      combos.map((x, i) => ({
        productId: row.id,
        size: x.s,
        colour: x.c,
        sku: [skuBase, x.c, x.s].filter(Boolean).join("-").replace(/\s+/g, "").toUpperCase().slice(0, 64) + `-${row.id.slice(0, 4).toUpperCase()}`,
        pricePkr: price,
        stockQty: stock,
        available: stock !== 0,
        sort: i,
      })),
    );
    const uploads = files(fd, "images").slice(0, 10);
    for (const [i, f] of uploads.entries()) {
      const url = await saveUpload(f, { uploadedById: user.id, alt: p.title });
      await d.insert(brandProductImages).values({ productId: row.id, url, alt: p.title, kind: "photo", sort: i });
    }
    await audit({ actorUserId: user.id, action: "brand_portal.product_create", entity: "brand_product", entityId: row.id, summary: `${user.brand.name} added ${row.title} (draft, ${combos.length} variant${combos.length === 1 ? "" : "s"})` });
    id = row.id;
  });
  if (r?.error) return r;
  redirect(`/brand-portal/products/${id}?created=1`);
}

type VariantRow = { id: string | null; size: string | null; colour: string | null; sku: string | null; price: number | null; compareAt: number | null; stock: number | null; available: boolean; remove: boolean };

function readVariants(fd: FormData): VariantRow[] {
  const rows: VariantRow[] = [];
  const indexes = new Set<number>();
  for (const key of fd.keys()) {
    const m = /^v\.(\d+)\./.exec(key);
    if (m) indexes.add(Number(m[1]));
  }
  for (const i of [...indexes].sort((a, b) => a - b)) {
    const g = (k: string, max = 64) => text(fd, `v.${i}.${k}`, max);
    const row: VariantRow = {
      id: g("id", 40),
      size: g("size", 40),
      colour: g("colour", 60),
      sku: g("sku", 64),
      price: rupees(g("price", 20)),
      compareAt: rupees(g("compareAt", 20)),
      stock: g("stock", 10) == null ? null : Number(g("stock", 10)),
      available: fd.get(`v.${i}.available`) === "on",
      remove: fd.get(`v.${i}.remove`) === "on",
    };
    if (!row.id && !row.size && !row.colour && !row.sku && row.price == null) continue; // empty "add" row
    rows.push(row);
  }
  return rows;
}

export async function updatePortalProduct(_prev: PortalState, fd: FormData): Promise<PortalState> {
  return run(async () => {
    const user = await assertBrandMember();
    const product = await ownProduct(user.brandId, String(fd.get("id") ?? ""));
    const p = readProduct(fd);
    const collection = await checkCollection(user.brandId, p.collection);
    const wanted = (STATUSES as readonly string[]).includes(String(fd.get("status"))) ? (String(fd.get("status")) as (typeof STATUSES)[number]) : product.status;
    const rows = readVariants(fd);
    const d = await db();
    const current = await d.select().from(brandProductVariants).where(eq(brandProductVariants.productId, product.id));
    const keep = rows.filter((r) => !r.remove);
    if (!keep.length) throw new BrandPortalError("Keep at least one variant (size / colour).");
    for (const [i, r] of keep.entries()) {
      const label = `Variant ${i + 1}`;
      if (r.id && !current.some((c) => c.id === r.id)) throw new BrandPortalError(`${label} doesn't belong to this product.`);
      if (r.price == null || Number.isNaN(r.price)) throw new BrandPortalError(`${label}: enter the price in rupees.`);
      if (r.compareAt != null && Number.isNaN(r.compareAt)) throw new BrandPortalError(`${label}: the original price isn't a valid amount.`);
      if (r.stock != null && (!Number.isInteger(r.stock) || r.stock < 0 || r.stock > 100_000)) throw new BrandPortalError(`${label}: stock must be a whole number (or blank if you don't track it).`);
      if (r.sku && !/^[\w.\-/ ]{1,64}$/.test(r.sku)) throw new BrandPortalError(`${label}: SKU may use letters, numbers, spaces and - _ . /`);
    }
    const combos = keep.map((r) => `${(r.size ?? "").toLowerCase()}|${(r.colour ?? "").toLowerCase()}`);
    if (new Set(combos).size !== combos.length) throw new BrandPortalError("Two variants have the same size and colour.");
    const skus = keep.map((r) => r.sku?.toUpperCase()).filter((s): s is string => !!s);
    if (new Set(skus).size !== skus.length) throw new BrandPortalError("Two variants have the same SKU.");
    if (skus.length) {
      const clash = await d
        .select({ sku: brandProductVariants.sku })
        .from(brandProductVariants)
        .innerJoin(brandProducts, eq(brandProducts.id, brandProductVariants.productId))
        .where(and(eq(brandProducts.brandId, user.brandId), ne(brandProducts.id, product.id), inArray(sql`upper(${brandProductVariants.sku})`, skus)));
      if (clash.length) throw new BrandPortalError(`SKU ${clash[0].sku} is already used by another of your products.`);
    }

    await d.update(brandProducts).set({ ...p, collection }).where(eq(brandProducts.id, product.id));
    const removeIds = rows.filter((r) => r.remove && r.id).map((r) => r.id!);
    if (removeIds.length) await d.delete(brandProductVariants).where(and(eq(brandProductVariants.productId, product.id), inArray(brandProductVariants.id, removeIds)));
    for (const [i, r] of keep.entries()) {
      const values = {
        size: r.size,
        colour: r.colour,
        sku: r.sku,
        pricePkr: r.price!,
        compareAtPricePkr: r.compareAt != null && r.compareAt > r.price! ? r.compareAt : null,
        stockQty: r.stock,
        available: r.available && r.stock !== 0,
        sort: i,
      };
      if (r.id) await d.update(brandProductVariants).set(values).where(eq(brandProductVariants.id, r.id));
      else await d.insert(brandProductVariants).values({ productId: product.id, externalId: r.sku, ...values });
    }
    await refreshProductPrice(d, product.id);

    // Photos: remove ticked, append uploads.
    const removeImages = fd.getAll("removeImage").map(String);
    if (removeImages.length) await d.delete(brandProductImages).where(and(eq(brandProductImages.productId, product.id), inArray(brandProductImages.id, removeImages)));
    const existing = await d.select().from(brandProductImages).where(eq(brandProductImages.productId, product.id));
    const uploads = files(fd, "images").slice(0, Math.max(0, 10 - existing.length));
    for (const [i, f] of uploads.entries()) {
      const url = await saveUpload(f, { uploadedById: user.id, alt: p.title });
      await d.insert(brandProductImages).values({ productId: product.id, url, alt: p.title, kind: "photo", sort: existing.length + i });
    }

    const status = await applyStatus(user.brandId, product.id, wanted, product.status);
    await audit({ actorUserId: user.id, action: "brand_portal.product_update", entity: "brand_product", entityId: product.id, summary: `${user.brand.name} edited ${p.title} (${keep.length} variants, ${status.status})` });
    return { message: status.message ?? (status.status === "published" ? "Saved — live on your brand page" : "Saved") };
  });
}

/** Publishing needs what buyers need: a photo and at least one variant. */
async function applyStatus(brandId: string, productId: string, wanted: (typeof STATUSES)[number], before: string) {
  const d = await db();
  if (wanted === "published") {
    const p = await d.query.brandProducts.findFirst({ where: eq(brandProducts.id, productId), with: { images: true, variants: true } });
    const issues = brandProductIssues({ title: p!.title, status: "published", imageCount: p!.images.length, variantCount: p!.variants.length, isDemo: p!.isDemo, description: p!.description }, { demoMode: isDemoMode() });
    if (issues.length) {
      if (before === "published") await d.update(brandProducts).set({ status: "draft" }).where(eq(brandProducts.id, productId));
      return { status: "draft" as const, message: `Saved as a draft — to publish: ${issues.map((i) => i.message.toLowerCase()).join(", ")}.` };
    }
  }
  await d
    .update(brandProducts)
    .set({ status: wanted, ...(wanted === "published" && before !== "published" ? { publishedAt: new Date() } : {}) })
    .where(eq(brandProducts.id, productId));
  if (wanted === "published" && before !== "published") await queueBrandAlerts(brandId);
  return { status: wanted, message: null };
}

export async function setPortalProductStatus(_prev: PortalState, fd: FormData): Promise<PortalState> {
  return run(async () => {
    const user = await assertBrandMember();
    const product = await ownProduct(user.brandId, String(fd.get("id") ?? ""));
    const wanted = String(fd.get("status"));
    if (!(STATUSES as readonly string[]).includes(wanted)) throw new BrandPortalError("Unknown status.");
    const r = await applyStatus(user.brandId, product.id, wanted as (typeof STATUSES)[number], product.status);
    if (r.message) throw new BrandPortalError(r.message.replace("Saved as a draft — to publish:", "To publish, add:"));
    await audit({ actorUserId: user.id, action: `brand_portal.product_${wanted}`, entity: "brand_product", entityId: product.id, summary: `${user.brand.name} set ${product.title} to ${wanted}` });
    return { message: wanted === "published" ? `${product.title} is live` : wanted === "hidden" ? `${product.title} hidden` : `${product.title} moved to draft` };
  });
}

// ── CSV import ──────────────────────────────────────────────────────────────

export type ImportState = { error?: string; ok?: boolean; message?: string; preview?: ImportPreview; csv?: string; fileName?: string } | null;

/** Step 1: validate and plan (nothing is written). Step 2 (`confirm`): re-validate the same text and import. */
export async function portalImportAction(prev: ImportState, fd: FormData): Promise<ImportState> {
  try {
    const user = await assertBrandMember();
    if (fd.get("step") === "confirm") {
      const csv = String(fd.get("csv") ?? "");
      if (!csv) return { error: "Upload the file again." };
      const r = await runBrandImport(user.brandId, csv, user.id);
      if (!r.ok) return { error: r.error };
      refresh();
      const c = r.plan.counts;
      return { ok: true, message: `Imported: ${c.productsCreate} new, ${c.productsUpdate} updated, ${c.productsUnchanged} unchanged products${c.skipped ? `; ${c.skipped} skipped with errors` : ""}. New products are drafts until you publish them.` };
    }
    const file = files(fd, "file")[0];
    if (!file) return { error: "Choose a CSV file." };
    if (file.size > BRAND_CSV_MAX_BYTES) return { error: "The file is larger than 2 MB — split it into smaller files." };
    if (!/\.csv$/i.test(file.name) && !/csv|text\/plain|excel/.test(file.type)) return { error: "Upload a .csv file (in Excel or Google Sheets: File → Download → CSV)." };
    const csv = await file.text();
    const preview = await previewBrandImport(user.brandId, csv);
    if (preview.refused) return { error: preview.refused };
    return { preview, csv, fileName: file.name };
  } catch (e) {
    if (e instanceof BrandPortalError) return { error: e.message };
    console.error("[brand portal import]", e);
    return { error: "Couldn't read that file. Check it's a CSV saved from the template." };
  }
}

// ── Collections ─────────────────────────────────────────────────────────────

export async function saveCollection(_prev: PortalState, fd: FormData): Promise<PortalState> {
  return run(async () => {
    const user = await assertBrandMember();
    const name = text(fd, "name", 120);
    if (!name || name.length < 2) throw new BrandPortalError("Name the collection.");
    const description = text(fd, "description", 500);
    const id = text(fd, "id", 40);
    const d = await db();
    if (id) {
      const c = await d.query.brandCollections.findFirst({ where: and(eq(brandCollections.id, id), eq(brandCollections.brandId, user.brandId)) });
      if (!c) throw new BrandPortalError("Collection not found.");
      await d.update(brandCollections).set({ name, description, sort: Number(text(fd, "sort", 6) ?? c.sort) || 0 }).where(eq(brandCollections.id, c.id));
      if (c.name !== name) await d.update(brandProducts).set({ collection: name }).where(and(eq(brandProducts.brandId, user.brandId), eq(brandProducts.collection, c.name)));
      await audit({ actorUserId: user.id, action: "brand_portal.collection_update", entity: "brand", entityId: user.brandId, summary: `${user.brand.name} edited collection ${name}` });
      return { message: "Collection saved" };
    }
    await d.insert(brandCollections).values({ brandId: user.brandId, name, description, sort: Number(text(fd, "sort", 6) ?? 0) || 0 });
    await audit({ actorUserId: user.id, action: "brand_portal.collection_create", entity: "brand", entityId: user.brandId, summary: `${user.brand.name} added collection ${name}` });
    return { message: `${name} added` };
  });
}

export async function deleteCollection(_prev: PortalState, fd: FormData): Promise<PortalState> {
  return run(async () => {
    const user = await assertBrandMember();
    const d = await db();
    const c = await d.query.brandCollections.findFirst({ where: and(eq(brandCollections.id, String(fd.get("id") ?? "")), eq(brandCollections.brandId, user.brandId)) });
    if (!c) throw new BrandPortalError("Collection not found.");
    await d.update(brandProducts).set({ collection: null }).where(and(eq(brandProducts.brandId, user.brandId), eq(brandProducts.collection, c.name)));
    await d.delete(brandCollections).where(eq(brandCollections.id, c.id));
    await audit({ actorUserId: user.id, action: "brand_portal.collection_delete", entity: "brand", entityId: user.brandId, summary: `${user.brand.name} removed collection ${c.name}` });
    return { message: `${c.name} removed` };
  });
}

/** Put products into a collection (or take them out with an empty name). */
export async function assignCollection(_prev: PortalState, fd: FormData): Promise<PortalState> {
  return run(async () => {
    const user = await assertBrandMember();
    const ids = fd.getAll("productIds").map(String);
    if (!ids.length) throw new BrandPortalError("Tick at least one product.");
    const name = await checkCollection(user.brandId, text(fd, "collection", 120));
    const d = await db();
    const done = await d
      .update(brandProducts)
      .set({ collection: name })
      .where(and(eq(brandProducts.brandId, user.brandId), inArray(brandProducts.id, ids)))
      .returning({ id: brandProducts.id });
    return { message: `${done.length} product${done.length === 1 ? "" : "s"} ${name ? `added to ${name}` : "taken out of their collection"}` };
  });
}

// ── Brand profile ───────────────────────────────────────────────────────────

export async function updatePortalProfile(_prev: PortalState, fd: FormData): Promise<PortalState> {
  return run(async () => {
    const user = await assertBrandMember();
    const d = await db();
    const about = text(fd, "description", 2000);
    if (looksLikePlaceholderText(about)) throw new BrandPortalError("Replace placeholder text in “About” before saving.");
    const website = text(fd, "websiteUrl", 300);
    if (website && !/^https?:\/\/[^\s.]+\.[^\s]+$/.test(website)) throw new BrandPortalError("Website: enter a full link, e.g. https://yourbrand.pk");
    const socials = parseSocialLinks(Object.fromEntries(SOCIAL_KEYS.map((k) => [k, text(fd, `social.${k}`, 300)])));
    if (!socials.ok) throw new BrandPortalError(socials.error);
    const unit = fd.get("sizeUnit") === "cm" ? "cm" : "in";
    const guide = parseSizeGuide(text(fd, "sizeGrid", 10_000) ?? "", unit, text(fd, "sizeNote", 500));
    if (!guide.ok) throw new BrandPortalError(`Size guide: ${guide.error}`);
    const logo = files(fd, "logo")[0];
    const banner = files(fd, "banner")[0];
    const profile = await d.query.brandProfiles.findFirst({ where: eq(brandProfiles.brandId, user.brandId) });
    const logoUrl = logo ? await saveUpload(logo, { uploadedById: user.id, alt: `${user.brand.name} logo` }) : fd.get("removeLogo") === "on" ? null : user.brand.logoUrl;
    const bannerUrl = banner ? await saveUpload(banner, { uploadedById: user.id, alt: `${user.brand.name} banner` }) : fd.get("removeBanner") === "on" ? null : (profile?.bannerUrl ?? null);
    const audiences = fd.getAll("audiences").filter((a): a is (typeof AUDIENCES)[number] => (AUDIENCES as readonly string[]).includes(String(a)));
    await d
      .update(brands)
      .set({ description: about, websiteUrl: website, logoUrl, sizeGuide: guide.guide, ...(audiences.length ? { audiences } : {}) })
      .where(eq(brands.id, user.brandId));
    await d
      .insert(brandProfiles)
      .values({ brandId: user.brandId, bannerUrl, socials: socials.links, selfListed: true })
      .onConflictDoUpdate({ target: brandProfiles.brandId, set: { bannerUrl, socials: socials.links } });
    await audit({ actorUserId: user.id, action: "brand_portal.profile", entity: "brand", entityId: user.brandId, summary: `${user.brand.name} updated its brand page (logo, banner, about, links, size guide)` });
    return { message: "Brand page saved" };
  });
}

// ── Orders (fulfil hook) ────────────────────────────────────────────────────

export async function markItemsReady(_prev: PortalState, fd: FormData): Promise<PortalState> {
  return run(async () => {
    const user = await assertBrandMember();
    const ids = fd.getAll("itemIds").map(String);
    const e = await markBrandItemsReady({ brandId: user.brandId, orderItemIds: ids, actorUserId: user.id, note: text(fd, "note", 300) });
    return { message: `${e.orderItemIds.length} item${e.orderItemIds.length === 1 ? "" : "s"} on ${e.orderNumber} marked ready for collection` };
  });
}
