import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, type Db } from "@/lib/db/client";
import { brandProductImages, brandProducts, brandProductVariants, brands, brandSyncRuns } from "@/lib/db/schema";
import { audit } from "@/lib/audit";
import { slugify } from "@/lib/brands/adapters/normalize";
import { hasRecordedPermission } from "@/lib/brands/permission";
import { queueBrandAlerts } from "@/lib/brands/alerts";
import { planBrandImport, validateBrandCsv, variantPatch, type ExistingProduct, type ExistingVariant, type ImportPlan, type ValidatedCsv } from "./csv";

/**
 * Brand portal CSV import. `previewBrandImport` validates and plans without
 * writing; `runBrandImport` re-validates the same text server-side and applies
 * the plan in one transaction. Both refuse when the brand has no recorded
 * permission (for self-listed brands: the accepted seller terms).
 */
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type ImportPreview = { validated: ValidatedCsv; plan: ImportPlan | null; refused: string | null };

async function loadBrand(brandId: string) {
  const d = await db();
  const brand = await d.query.brands.findFirst({ where: eq(brands.id, brandId) });
  if (!brand) throw new Error("Brand not found");
  return brand;
}

function gate(brand: typeof brands.$inferSelect): string | null {
  return hasRecordedPermission(brand) ? null : "No permission is recorded for this brand — import refused. Contact Wahbayaan.";
}

async function loadExisting(q: Db | Tx, brandId: string): Promise<{ products: ExistingProduct[]; variants: ExistingVariant[] }> {
  const rows = await q.select().from(brandProducts).where(eq(brandProducts.brandId, brandId));
  const ids = rows.map((r) => r.id);
  const [imgs, vars] = ids.length
    ? await Promise.all([
        q.select().from(brandProductImages).where(inArray(brandProductImages.productId, ids)),
        q.select().from(brandProductVariants).where(inArray(brandProductVariants.productId, ids)),
      ])
    : [[], []];
  return {
    products: rows.map((p) => ({
      id: p.id,
      externalId: p.externalId,
      title: p.title,
      description: p.description,
      audience: p.audience,
      category: p.category,
      collection: p.collection,
      fabric: p.fabric,
      tags: p.tags,
      weightG: p.weightG,
      status: p.status,
      imageUrls: imgs.filter((i) => i.productId === p.id).sort((a, b) => a.sort - b.sort).map((i) => i.url),
    })),
    variants: vars.map((v) => ({ id: v.id, productId: v.productId, sku: v.sku, size: v.size, colour: v.colour, pricePkr: v.pricePkr, compareAtPricePkr: v.compareAtPricePkr, stockQty: v.stockQty, available: v.available })),
  };
}

const defaultAudience = (b: typeof brands.$inferSelect) => (b.audiences.length === 1 ? b.audiences[0] : "women");

export async function previewBrandImport(brandId: string, csvText: string): Promise<ImportPreview> {
  const brand = await loadBrand(brandId);
  const validated = validateBrandCsv(csvText, { defaultAudience: defaultAudience(brand) });
  const refused = gate(brand);
  if (refused || validated.fatal) return { validated, plan: null, refused };
  return { validated, plan: planBrandImport(validated, await loadExisting(await db(), brandId)), refused: null };
}

export type ImportOutcome = { ok: true; plan: ImportPlan; runId: string } | { ok: false; error: string };

async function uniqueSlug(tx: Tx, base: string) {
  const root = slugify(base) || "item";
  for (let i = 1; i < 60; i++) {
    const slug = i === 1 ? root : `${root}-${i}`;
    const hit = await tx.query.brandProducts.findFirst({ where: eq(brandProducts.slug, slug), columns: { id: true } });
    if (!hit) return slug;
  }
  return `${root}-${Date.now().toString(36)}`;
}

/** Lowest variant price becomes the product price (and its original price the product's). */
export async function refreshProductPrice(q: Db | Tx, productId: string) {
  const vars = await q.select().from(brandProductVariants).where(eq(brandProductVariants.productId, productId));
  const priced = vars.filter((v) => v.pricePkr != null);
  if (!priced.length) return;
  const cheapest = priced.reduce((a, b) => (b.pricePkr! < a.pricePkr! ? b : a));
  await q.update(brandProducts).set({ pricePkr: cheapest.pricePkr!, compareAtPricePkr: cheapest.compareAtPricePkr ?? null }).where(eq(brandProducts.id, productId));
}

export async function runBrandImport(brandId: string, csvText: string, actorUserId: string): Promise<ImportOutcome> {
  const brand = await loadBrand(brandId);
  const refused = gate(brand);
  const d = await db();
  if (refused) {
    await d.insert(brandSyncRuns).values({ brandId, sourceType: "csv_feed", trigger: "portal", status: "refused", errors: [refused], triggeredById: actorUserId, finishedAt: new Date() });
    await audit({ actorUserId, action: "brand.portal_import_refused", entity: "brand", entityId: brandId, summary: `CSV import refused for ${brand.name}: ${refused}` });
    return { ok: false, error: refused };
  }
  const validated = validateBrandCsv(csvText, { defaultAudience: defaultAudience(brand) });
  if (validated.fatal) return { ok: false, error: validated.fatal };
  if (!validated.products.length) return { ok: false, error: "Nothing to import — every product has errors. Fix them and upload again." };

  const now = new Date();
  const result = await d.transaction(async (tx) => {
    const existing = await loadExisting(tx, brandId);
    const plan = planBrandImport(validated, existing);
    const byId = new Map(existing.products.map((p) => [p.id, p]));
    let published = false;
    for (const pp of plan.products) {
      if (pp.action === "unchanged") continue;
      const patch = pp.patch;
      const fields = {
        title: patch.title,
        description: patch.description,
        audience: patch.audience as "women" | "men" | "kids" | "unisex",
        category: patch.category,
        collection: patch.collection,
        fabric: patch.fabric,
        tags: patch.tags,
        weightG: patch.weightG,
        externalId: pp.csv.handle,
        lastSyncedAt: now,
      };
      const status = patch.status as "draft" | "published" | "hidden";
      let productId = pp.productId;
      if (productId) {
        const before = byId.get(productId)!;
        await tx
          .update(brandProducts)
          .set({ ...fields, status, ...(status === "published" && before.status !== "published" ? { publishedAt: now } : {}) })
          .where(and(eq(brandProducts.id, productId), eq(brandProducts.brandId, brandId)));
      } else {
        const first = pp.csv.variants[0];
        const [row] = await tx
          .insert(brandProducts)
          .values({
            brandId,
            slug: await uniqueSlug(tx, `${brand.slug}-${pp.csv.handle}`),
            ...fields,
            pricePkr: first.pricePkr,
            status,
            sourcePublishedAt: now,
            publishedAt: status === "published" ? now : null,
            isDemo: brand.isDemo,
          })
          .returning({ id: brandProducts.id });
        productId = row.id;
      }
      if (status === "published") published = true;
      if (pp.csv.imageUrls.length && (!pp.productId || pp.changes.includes("imageUrls"))) {
        await tx.delete(brandProductImages).where(eq(brandProductImages.productId, productId));
        await tx.insert(brandProductImages).values(pp.csv.imageUrls.map((url, i) => ({ productId: productId!, url, alt: pp.csv.title, kind: "photo" as const, sort: i })));
      }
      for (const [i, pv] of pp.variants.entries()) {
        if (pv.action === "unchanged") continue;
        const values = { ...variantPatch(pv.csv), sort: i };
        if (pv.variantId) await tx.update(brandProductVariants).set({ ...values, productId }).where(eq(brandProductVariants.id, pv.variantId));
        else await tx.insert(brandProductVariants).values({ productId, externalId: pv.csv.sku, ...values });
      }
      await refreshProductPrice(tx, productId);
    }
    const c = plan.counts;
    const [run] = await tx
      .insert(brandSyncRuns)
      .values({
        brandId,
        sourceType: "csv_feed",
        trigger: "portal",
        status: c.skipped ? "partial" : "succeeded",
        added: c.productsCreate,
        updated: c.productsUpdate,
        unchanged: c.productsUnchanged,
        failed: c.skipped,
        errors: validated.errors.slice(0, 50).map((e) => `Row ${e.line}${e.column ? ` (${e.column})` : ""}: ${e.message}`),
        triggeredById: actorUserId,
        finishedAt: new Date(),
      })
      .returning({ id: brandSyncRuns.id });
    return { plan, runId: run.id, published };
  });
  if (result.published) await queueBrandAlerts(brandId);
  const c = result.plan.counts;
  await audit({
    actorUserId,
    action: "brand.portal_import",
    entity: "brand",
    entityId: brandId,
    summary: `${brand.name} CSV import: ${c.productsCreate} products added, ${c.productsUpdate} updated, ${c.productsUnchanged} unchanged; variants ${c.variantsCreate} added, ${c.variantsUpdate} updated; ${c.skipped} skipped`,
    data: { runId: result.runId, counts: c },
  });
  return { ok: true, plan: result.plan, runId: result.runId };
}
