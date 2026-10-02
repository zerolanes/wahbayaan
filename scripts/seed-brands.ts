/**
 * Pakistani Brands seed data.
 *
 * - Base: real brands the owner named are pre-created as DISABLED drafts —
 *   partnership "none", no permission, sync off, no products, no logos or
 *   catalogue content. Nothing about them is public. Courier rows are created
 *   for the courier names already used by the pending rate table (inactive,
 *   "pending contract").
 * - Demo: clearly FICTIONAL brands (isDemo) built from the hand-written
 *   fixtures in tests/fixtures/brands/. None of this is real brand data.
 */
import fs from "node:fs";
import path from "node:path";
import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "../src/lib/db/connect";
import * as t from "../src/lib/db/schema";
import { parseShopifyProducts } from "../src/lib/brands/adapters/shopify";
import type { NormalizedProduct } from "../src/lib/brands/types";

const REAL_BRANDS = [
  { slug: "sana-safinaz", name: "Sana Safinaz", audiences: ["women"] as const },
  { slug: "khaadi", name: "Khaadi", audiences: ["women", "men"] as const },
  { slug: "maria-b", name: "Maria B", audiences: ["women"] as const },
  { slug: "junaid-jamshed", name: "J. (Junaid Jamshed)", audiences: ["women", "men"] as const },
];

export async function seedBrandsBase(db: Db) {
  for (const [i, b] of REAL_BRANDS.entries()) {
    const existing = await db.query.brands.findFirst({ where: eq(t.brands.slug, b.slug) });
    if (existing) continue;
    const [row] = await db
      .insert(t.brands)
      .values({
        slug: b.slug,
        name: b.name,
        audiences: [...b.audiences],
        partnership: "none",
        isActive: false,
        sort: 100 + i,
        partnershipNote: "Not contacted yet. No permission recorded: no catalogue import and no public brand page until the brand authorises us.",
      })
      .returning();
    await db.insert(t.brandSources).values({ brandId: row.id, type: "manual", syncEnabled: false });
  }

  // Couriers for the names the (pending) international rate table already uses.
  const names = [...new Set((await db.select({ courier: t.shippingRates.courier }).from(t.shippingRates).where(isNull(t.shippingRates.courierId))).map((r) => r.courier))];
  for (const name of names) {
    let courier = await db.query.couriers.findFirst({ where: eq(t.couriers.name, name) });
    if (!courier)
      [courier] = await db
        .insert(t.couriers)
        .values({ name, international: true, domestic: false, isActive: false, contractNotes: "Pending contract — rates stay pending until the negotiated rate card is entered." })
        .returning();
    await db.update(t.shippingRates).set({ courierId: courier.id }).where(and(eq(t.shippingRates.courier, name), isNull(t.shippingRates.courierId)));
  }
}

function fixture(name: string) {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "tests", "fixtures", "brands", name), "utf8"));
}

async function insertProduct(db: Db, brandId: string, brandSlug: string, p: NormalizedProduct, status: "published" | "draft") {
  const [row] = await db
    .insert(t.brandProducts)
    .values({
      brandId,
      externalId: p.externalId,
      slug: `${brandSlug}-${p.handle}`.slice(0, 90),
      title: p.title,
      description: p.description,
      audience: p.audience,
      category: p.category,
      collection: p.collection,
      fabric: p.fabric,
      tags: p.tags,
      sourceUrl: p.sourceUrl,
      pricePkr: p.pricePkr,
      compareAtPricePkr: p.compareAtPricePkr,
      weightG: p.weightG,
      status,
      sourcePublishedAt: p.publishedAt,
      publishedAt: status === "published" ? new Date() : null,
      lastSyncedAt: new Date(),
      isDemo: true,
    })
    .returning();
  if (p.images.length) await db.insert(t.brandProductImages).values(p.images.map((img, i) => ({ productId: row.id, url: img.url, alt: img.alt, kind: "illustration" as const, sort: i })));
  for (const [i, v] of p.variants.entries())
    await db.insert(t.brandProductVariants).values({
      productId: row.id,
      externalId: v.externalId,
      sku: v.sku,
      size: v.size,
      colour: v.colour,
      pricePkr: v.pricePkr,
      compareAtPricePkr: v.compareAtPricePkr,
      stockQty: v.stockQty,
      available: v.available && v.stockQty !== 0,
      sort: i,
    });
  return row;
}

// Dates relative to now so "new arrivals" stays meaningful in the demo.
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

export async function seedBrandsDemo(db: Db, ids: { ownerId: string; usBuyerId: string; passwordHash: string }) {
  if (await db.query.brands.findFirst({ where: eq(t.brands.slug, "noor-lawn-house") })) return;

  // A demo buyer in Pakistan (sees PKR).
  const [pkBuyer] = await db
    .insert(t.users)
    .values({ email: "buyer.pk@wahbayaan.test", name: "Demo Buyer (Pakistan)", passwordHash: ids.passwordHash, role: "buyer", country: "PK", isDemo: true })
    .onConflictDoNothing()
    .returning();
  if (pkBuyer)
    await db.insert(t.addresses).values({ userId: pkBuyer.id, label: "Home", fullName: "Demo Buyer", line1: "House 10, Street 5", city: "Lahore", region: "Punjab", country: "PK", phone: "+92 300 0000001", isDefault: true });

  // 1. Noor Lawn House — fictional, authorised (demo permission record), live.
  const [noor] = await db
    .insert(t.brands)
    .values({
      slug: "noor-lawn-house",
      name: "Noor Lawn House",
      logoUrl: "/brand-art/logo/NL-3.svg",
      websiteUrl: "https://noor-lawn-house.example",
      description: "Printed lawn, festive pret and wedding formals. (Fictional demo brand.)",
      audiences: ["women"],
      partnership: "authorised",
      partnershipNote: "Demo: fictional brand used to show an authorised partner.",
      permissionGrantedAt: daysAgo(20),
      permissionGrantedById: ids.ownerId,
      permissionNote: "DEMO permission record for a fictional brand — not a real agreement.",
      isActive: true,
      defaultWeightG: 900,
      sizeGuide: {
        unit: "in",
        columns: ["Chest", "Waist", "Shirt length"],
        rows: [
          { size: "XS", values: ["34", "30", "40"] },
          { size: "S", values: ["36", "32", "41"] },
          { size: "M", values: ["38", "34", "42"] },
          { size: "L", values: ["41", "37", "43"] },
        ],
        note: "Demo chart for a fictional brand.",
      },
      sort: 1,
      isDemo: true,
    })
    .returning();
  await db.insert(t.brandSources).values({ brandId: noor.id, type: "shopify_json", config: { url: "fixture:noor-lawn-house", rateLimitMs: 2000, currency: "PKR" }, syncEnabled: true, lastSyncAt: daysAgo(1) });
  const noorFeed = parseShopifyProducts(fixture("noor-lawn-house.json"), { storefrontOrigin: "https://noor-lawn-house.example", assetOrigin: "", defaultAudience: "women" });
  for (const [i, p] of noorFeed.products.entries()) await insertProduct(db, noor.id, noor.slug, { ...p, publishedAt: daysAgo([3, 40, 1][i] ?? 10) }, "published");
  await db.insert(t.brandSyncRuns).values({
    brandId: noor.id,
    sourceType: "shopify_json",
    trigger: "admin",
    status: "partial",
    added: noorFeed.products.length,
    failed: noorFeed.failures.length,
    errors: noorFeed.failures.map((f) => `${f.ref}: ${f.reason}`),
    triggeredById: ids.ownerId,
    startedAt: daysAgo(1),
    finishedAt: daysAgo(1),
  });

  // 2. Sahil Menswear — fictional, partnership requested, NO permission yet: a
  //    draft brand. The admin records permission → syncs from the fixture → publishes.
  const [sahil] = await db
    .insert(t.brands)
    .values({
      slug: "sahil-menswear",
      name: "Sahil Menswear",
      logoUrl: "/brand-art/logo/SM-4.svg",
      websiteUrl: "https://sahil-menswear.example",
      description: "Kurta shalwar, wash-and-wear and wedding waistcoats. (Fictional demo brand.)",
      audiences: ["men"],
      partnership: "requested",
      partnershipNote: "Demo: we've written to the (fictional) brand and are waiting for their reply.",
      isActive: false,
      defaultWeightG: 650,
      sort: 2,
      isDemo: true,
    })
    .returning();
  await db.insert(t.brandSources).values({ brandId: sahil.id, type: "shopify_json", config: { url: "fixture:sahil-menswear", rateLimitMs: 1000, currency: "PKR", maxPages: 5 }, syncEnabled: false });

  // 3. A demo link request ("shop any brand by link") from the US buyer, as a gift to Pakistan.
  const [req] = await db
    .insert(t.orders)
    .values({
      number: "WB-2001",
      kind: "brand",
      brandFlow: "link_request",
      userId: ids.usBuyerId,
      email: "buyer@wahbayaan.test",
      customerName: "Demo Buyer (US)",
      currency: "USD",
      fxPkrPerUnit: "280",
      fxSource: "Placeholder (demo)",
      destinationCountry: "PK",
      shippingAddress: { fullName: "Demo Recipient", line1: "House 1, Street 2", city: "Lahore", region: "Punjab", postalCode: null, country: "PK", phone: "+92 300 0000000" },
      status: "awaiting_quote",
      itemsSubtotal: 0,
      shippingStatus: "pending",
      dutyStatus: "not_applicable",
      importTaxStatus: "not_applicable",
      handlingStatus: "not_applicable",
      serviceFeeStatus: "pending",
      paymentMethod: "card",
      total: 0,
      totalComplete: false,
      isGift: true,
      giftMessage: "Eid Mubarak!",
      createdAt: daysAgo(1),
      isDemo: true,
    })
    .returning();
  await db.insert(t.brandOrderItems).values([
    { orderId: req.id, brandName: "Example Label", title: "Embroidered lawn 3-piece (demo)", size: "M", colour: "Mint", qty: 1, requestedUrl: "https://example-label.example/products/lawn-3pc", requestedDomain: "example-label.example", buyerNote: "Unstitched please" },
    { orderId: req.id, brandName: "Another Label", title: "Men's kurta (demo)", size: "L", colour: "White", qty: 1, requestedUrl: "https://another-label.example/p/kurta", requestedDomain: "another-label.example" },
  ]);
  await db.insert(t.brandFulfilments).values([
    { orderId: req.id, brandLabel: "Example Label" },
    { orderId: req.id, brandLabel: "Another Label" },
  ]);
  await db.insert(t.orderEvents).values({ orderId: req.id, kind: "request", message: "Request received for 2 items. Our team checks each item and its price at the brand, then sends you a quote to approve.", createdAt: daysAgo(1) });
}
