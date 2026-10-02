import "server-only";
import { createHash } from "node:crypto";
import { and, eq, inArray, isNotNull, notInArray } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { brandProductImages, brandProducts, brandProductVariants, brands, brandSources, brandSyncRuns } from "@/lib/db/schema";
import { audit } from "@/lib/audit";
import { parseBrandCsv } from "./adapters/csv";
import { fetchShopifyCatalog, type Transport } from "./adapters/shopify";
import { fixtureTransport, httpTransport, resolveSourceUrl } from "./adapters/transport";
import { slugify } from "./adapters/normalize";
import { syncGate, type SyncTrigger } from "./permission";
import { AdapterError, type BrandAudienceValue, type NormalizedProduct, type ParseResult } from "./types";

/**
 * Brand catalogue sync: adapter → normalized products → upsert.
 *
 * - The permission gate runs here, inside the engine, for every trigger (admin
 *   "Sync now", the cron route and feed uploads). A refused attempt is still
 *   recorded as a sync run so the history shows it.
 * - New products arrive as drafts; staff publish them in Admin → Brand products.
 * - Staff-owned fields (status, price override) are never touched by a sync.
 * - Products that vanish from a complete feed have their variants marked
 *   unavailable rather than deleted (orders still reference them).
 */
export type SyncOptions = {
  trigger: SyncTrigger;
  actorUserId: string | null;
  /** Feed upload text (CSV adapter). */
  csvText?: string;
  /** Injected in tests. Defaults to HTTPS (or recorded fixtures for `fixture:` URLs). */
  transport?: Transport;
  sleep?: (ms: number) => Promise<void>;
};

export type SyncOutcome = {
  runId: string;
  status: "succeeded" | "partial" | "failed" | "refused";
  added: number;
  updated: number;
  unchanged: number;
  failed: number;
  markedUnavailable: number;
  errors: string[];
};

const MAX_ERRORS = 50;
const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function sourceHash(p: NormalizedProduct) {
  return createHash("sha256").update(JSON.stringify(p)).digest("hex").slice(0, 32);
}

export async function runBrandSync(brandId: string, opts: SyncOptions): Promise<SyncOutcome> {
  const d = await db();
  const brand = await d.query.brands.findFirst({ where: eq(brands.id, brandId), with: { source: true } });
  if (!brand) throw new AdapterError("Brand not found");
  const source = brand.source ?? (await d.insert(brandSources).values({ brandId }).returning())[0];

  const gate = syncGate(
    {
      permissionGrantedAt: brand.permissionGrantedAt,
      permissionGrantedById: brand.permissionGrantedById,
      permissionNote: brand.permissionNote,
      sourceType: source.type,
      syncEnabled: source.syncEnabled,
      sourceUrl: source.config.url ?? null,
    },
    opts.trigger,
  );
  if (!gate.ok) {
    const [run] = await d
      .insert(brandSyncRuns)
      .values({ brandId, sourceType: source.type, trigger: opts.trigger, status: "refused", errors: [gate.reason], triggeredById: opts.actorUserId, finishedAt: new Date() })
      .returning();
    await audit({ actorUserId: opts.actorUserId, action: "brand.sync_refused", entity: "brand", entityId: brandId, summary: `Sync refused for ${brand.name}: ${gate.reason}`, data: { trigger: opts.trigger } });
    return { runId: run.id, status: "refused", added: 0, updated: 0, unchanged: 0, failed: 0, markedUnavailable: 0, errors: [gate.reason] };
  }

  const [run] = await d.insert(brandSyncRuns).values({ brandId, sourceType: source.type, trigger: opts.trigger, status: "running", triggeredById: opts.actorUserId }).returning();
  const out: SyncOutcome = { runId: run.id, status: "succeeded", added: 0, updated: 0, unchanged: 0, failed: 0, markedUnavailable: 0, errors: [] };
  const fallbackAudience: BrandAudienceValue = brand.audiences.length === 1 ? brand.audiences[0] : "women";

  let parsed: ParseResult & { complete: boolean };
  try {
    if (source.type === "csv_feed") {
      if (!opts.csvText) throw new AdapterError("No feed file was uploaded.");
      parsed = { ...parseBrandCsv(opts.csvText, { defaultAudience: fallbackAudience }), complete: true };
    } else {
      const currency = (source.config.currency ?? "PKR").toUpperCase();
      if (currency !== "PKR") throw new AdapterError(`This source prices in ${currency}. Only PKR feeds are imported — nothing is converted.`);
      const resolved = resolveSourceUrl(source.config.url ?? "");
      const storefront = brand.websiteUrl ? new URL(brand.websiteUrl).origin : resolved.fixture ? "" : new URL(resolved.url).origin;
      parsed = await fetchShopifyCatalog({
        url: resolved.url,
        transport: opts.transport ?? (resolved.fixture ? fixtureTransport : httpTransport),
        sleep: opts.sleep ?? realSleep,
        rateLimitMs: source.config.rateLimitMs,
        maxPages: source.config.maxPages,
        storefrontOrigin: storefront,
        assetOrigin: resolved.fixture ? "" : new URL(resolved.url).origin,
        defaultAudience: fallbackAudience,
      });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await d.update(brandSyncRuns).set({ status: "failed", errors: [message], finishedAt: new Date() }).where(eq(brandSyncRuns.id, run.id));
    await audit({ actorUserId: opts.actorUserId, action: "brand.sync", entity: "brand", entityId: brandId, summary: `Sync failed for ${brand.name}: ${message}`, data: { runId: run.id } });
    return { ...out, status: "failed", errors: [message] };
  }

  for (const f of parsed.failures) {
    out.failed++;
    out.errors.push(`${f.ref}: ${f.reason}`);
  }

  const seen: string[] = [];
  for (const np of parsed.products) {
    seen.push(np.externalId);
    try {
      const result = await upsertProduct(brand.id, brand.slug, brand.isDemo, np);
      out[result]++;
    } catch (e) {
      out.failed++;
      out.errors.push(`${np.title}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Products that disappeared from a complete feed: mark their variants unavailable.
  if (parsed.complete && source.config.markMissingUnavailable !== false && parsed.products.length > 0) {
    const missing = await d
      .select({ id: brandProducts.id })
      .from(brandProducts)
      .where(and(eq(brandProducts.brandId, brand.id), isNotNull(brandProducts.externalId), seen.length ? notInArray(brandProducts.externalId, seen) : undefined));
    if (missing.length) {
      const ids = missing.map((m) => m.id);
      const changed = await d
        .update(brandProductVariants)
        .set({ available: false })
        .where(and(inArray(brandProductVariants.productId, ids), eq(brandProductVariants.available, true)))
        .returning({ productId: brandProductVariants.productId });
      out.markedUnavailable = new Set(changed.map((c) => c.productId)).size;
    }
  }

  const imported = out.added + out.updated + out.unchanged;
  out.status = out.failed === 0 ? "succeeded" : imported > 0 ? "partial" : "failed";
  out.errors = out.errors.slice(0, MAX_ERRORS);
  await d
    .update(brandSyncRuns)
    .set({ status: out.status, added: out.added, updated: out.updated, unchanged: out.unchanged, failed: out.failed, markedUnavailable: out.markedUnavailable, errors: out.errors, finishedAt: new Date() })
    .where(eq(brandSyncRuns.id, run.id));
  await d.update(brandSources).set({ lastSyncAt: new Date() }).where(eq(brandSources.id, source.id));
  await audit({
    actorUserId: opts.actorUserId,
    action: "brand.sync",
    entity: "brand",
    entityId: brandId,
    summary: `Synced ${brand.name} (${opts.trigger}): ${out.added} added, ${out.updated} updated, ${out.unchanged} unchanged, ${out.failed} failed`,
    data: { ...out, errors: out.errors.length },
  });
  return out;
}

async function uniqueSlug(base: string, productId?: string) {
  const d = await db();
  const root = slugify(base) || "item";
  for (let i = 1; i < 50; i++) {
    const slug = i === 1 ? root : `${root}-${i}`;
    const hit = await d.query.brandProducts.findFirst({ where: eq(brandProducts.slug, slug), columns: { id: true } });
    if (!hit || hit.id === productId) return slug;
  }
  return `${root}-${Date.now().toString(36)}`;
}

async function upsertProduct(brandId: string, brandSlug: string, isDemo: boolean, np: NormalizedProduct): Promise<"added" | "updated" | "unchanged"> {
  const d = await db();
  const hash = sourceHash(np);
  const existing = await d.query.brandProducts.findFirst({ where: and(eq(brandProducts.brandId, brandId), eq(brandProducts.externalId, np.externalId)) });
  const now = new Date();
  const sourceFields = {
    title: np.title,
    description: np.description,
    audience: np.audience,
    category: np.category,
    collection: np.collection,
    fabric: np.fabric,
    tags: np.tags,
    sourceUrl: np.sourceUrl,
    pricePkr: np.pricePkr,
    compareAtPricePkr: np.compareAtPricePkr,
    weightG: np.weightG,
    sourcePublishedAt: np.publishedAt,
    sourceHash: hash,
    lastSyncedAt: now,
  };

  if (existing && existing.sourceHash === hash) {
    await d.update(brandProducts).set({ lastSyncedAt: now }).where(eq(brandProducts.id, existing.id));
    return "unchanged";
  }

  let productId: string;
  if (existing) {
    productId = existing.id;
    await d.update(brandProducts).set(sourceFields).where(eq(brandProducts.id, productId));
  } else {
    const [row] = await d
      .insert(brandProducts)
      .values({ brandId, externalId: np.externalId, slug: await uniqueSlug(`${brandSlug}-${np.handle}`), status: "draft", isDemo, ...sourceFields })
      .returning({ id: brandProducts.id });
    productId = row.id;
  }

  // Images come from the source: replace them wholesale.
  await d.delete(brandProductImages).where(eq(brandProductImages.productId, productId));
  if (np.images.length)
    await d.insert(brandProductImages).values(
      np.images.map((img, i) => ({ productId, url: img.url, alt: img.alt ?? np.title, kind: img.url.startsWith("/brand-art/") ? ("illustration" as const) : ("photo" as const), sort: i })),
    );

  // Variants: update by external id, add new ones, mark vanished ones unavailable.
  const current = await d.select().from(brandProductVariants).where(eq(brandProductVariants.productId, productId));
  for (const [i, v] of np.variants.entries()) {
    const values = {
      sku: v.sku,
      size: v.size,
      colour: v.colour,
      pricePkr: v.pricePkr,
      compareAtPricePkr: v.compareAtPricePkr,
      stockQty: v.stockQty,
      available: v.available && v.stockQty !== 0,
      sort: i,
    };
    const match = current.find((c) => c.externalId === v.externalId);
    if (match) await d.update(brandProductVariants).set(values).where(eq(brandProductVariants.id, match.id));
    else await d.insert(brandProductVariants).values({ productId, externalId: v.externalId, ...values });
  }
  const gone = current.filter((c) => c.externalId && !np.variants.some((v) => v.externalId === c.externalId)).map((c) => c.id);
  if (gone.length) await d.update(brandProductVariants).set({ available: false }).where(inArray(brandProductVariants.id, gone));
  return existing ? "updated" : "added";
}

/** Cron: sync every brand whose sync is switched on (the gate re-checks permission). */
export async function runScheduledBrandSyncs(opts: { transport?: Transport; sleep?: (ms: number) => Promise<void> } = {}) {
  const d = await db();
  const due = await d
    .select({ brandId: brandSources.brandId })
    .from(brandSources)
    .where(and(eq(brandSources.syncEnabled, true), eq(brandSources.type, "shopify_json")));
  const results: { brandId: string; status: SyncOutcome["status"]; added: number; updated: number; failed: number }[] = [];
  for (const { brandId } of due) {
    const r = await runBrandSync(brandId, { trigger: "cron", actorUserId: null, ...opts });
    results.push({ brandId, status: r.status, added: r.added, updated: r.updated, failed: r.failed });
  }
  return results;
}
