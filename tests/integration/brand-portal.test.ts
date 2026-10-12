/**
 * Brand self-signup end to end against a throwaway embedded Postgres:
 * application + terms acceptance → approval (authorised from the acceptance)
 * → CSV import (row errors, idempotent upsert by SKU) → "mark ready" hook.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wb-brand-portal-"));
process.env.PGLITE_DIR = path.join(dir, "db");
process.env.DATABASE_URL = "";

type Mods = {
  connect: typeof import("@/lib/db/connect");
  t: typeof import("@/lib/db/schema");
  onboarding: typeof import("@/lib/brand-portal/onboarding");
  imp: typeof import("@/lib/brand-portal/import");
  fulfil: typeof import("@/lib/brand-portal/fulfil");
  terms: typeof import("@/lib/brand-portal/terms");
  vis: typeof import("@/lib/trust/visibility");
};
let m: Mods;
let applicantId = "";
let staffId = "";
let brandId = "";

const HEADER = "handle,title,description,audience,category,collection,fabric,tags,image_urls,size,colour,sku,price_pkr,compare_at_price_pkr,stock,weight_g,status";
const CSV = [
  HEADER,
  "zara-lawn,Zara Lawn 2-Piece,Printed lawn shirt and trousers.,women,Unstitched,Summer,Lawn,lawn,https://img.example/z1.jpg|https://img.example/z2.jpg,S,Rose,ZL-ROSE-S,5490,,4,800,published",
  "zara-lawn,,,,,,,,,M,Rose,ZL-ROSE-M,5490,,0,800,",
  "noor-kurta,Noor Kurta,Cotton kurta.,men,Kurta,,Cotton,,https://img.example/n1.jpg,M,White,NK-WHT-M,3900,4500,2,,",
  "broken,Broken Item,,women,,,,,,S,,BR-S,not-a-price,,,,",
].join("\n");

beforeAll(async () => {
  m = {
    connect: await import("@/lib/db/connect"),
    t: await import("@/lib/db/schema"),
    onboarding: await import("@/lib/brand-portal/onboarding"),
    imp: await import("@/lib/brand-portal/import"),
    fulfil: await import("@/lib/brand-portal/fulfil"),
    terms: await import("@/lib/brand-portal/terms"),
    vis: await import("@/lib/trust/visibility"),
  };
  const seed = await import("../../scripts/seed");
  const db = await m.connect.getDb();
  await seed.seedBase(db);
  const [staff] = await db.insert(m.t.users).values({ email: "ops@test.local", name: "Ops", role: "staff" }).returning();
  staffId = staff.id;
  const [applicant] = await db.insert(m.t.users).values({ email: "founder@label.example", name: "Hina Label", role: "buyer" }).returning();
  applicantId = applicant.id;
});

afterAll(async () => {
  await m.connect.closeDb();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("brand self-signup", () => {
  it("records the terms acceptance (who, when, version) with the application, audited", async () => {
    const { eq } = await import("drizzle-orm");
    const r = await m.onboarding.submitBrandApplication({
      userId: applicantId,
      brandName: "Hina Label",
      contactName: "Hina Ahmed",
      contactRole: "Founder",
      email: "Founder@Label.example",
      phone: "+92 300 0000000",
      websiteUrl: "https://hina-label.example",
      instagram: "@hinalabel",
      city: "Lahore",
      audiences: ["women"],
      productTypes: "Lawn, pret",
      catalogueSize: "20–50",
      about: "Small-batch printed lawn from Lahore.",
      termsVersion: m.terms.BRAND_SELLER_TERMS_VERSION,
      ipAddress: "203.0.113.5",
      userAgent: "test",
    });
    expect(r.acceptance).toMatchObject({ userId: applicantId, name: "Hina Ahmed", email: "founder@label.example", termsVersion: m.terms.BRAND_SELLER_TERMS_VERSION });
    expect(r.acceptance.acceptedAt).toBeInstanceOf(Date);
    const db = await m.connect.getDb();
    const audits = await db.select().from(m.t.auditLog).where(eq(m.t.auditLog.action, "brand_terms.accepted"));
    expect(audits).toHaveLength(1);
    await expect(
      m.onboarding.submitBrandApplication({ ...r.application, userId: applicantId, termsVersion: m.terms.BRAND_SELLER_TERMS_VERSION, ipAddress: null, userAgent: null, contactRole: null } as never),
    ).rejects.toThrow(/already have an application/);
  });

  it("refuses an outdated terms version", async () => {
    const db = await m.connect.getDb();
    const [other] = await db.insert(m.t.users).values({ email: "late@label.example", name: "Late", role: "buyer" }).returning();
    await expect(
      m.onboarding.submitBrandApplication({
        userId: other.id,
        brandName: "Late",
        contactName: "Late",
        contactRole: null,
        email: "late@label.example",
        phone: null,
        websiteUrl: null,
        instagram: null,
        city: null,
        audiences: [],
        productTypes: null,
        catalogueSize: null,
        about: null,
        termsVersion: "2020-old",
        ipAddress: null,
        userAgent: null,
      }),
    ).rejects.toThrow(/terms were updated/);
  });

  it("approval makes the brand authorised from the acceptance — no manual permission", async () => {
    const { eq } = await import("drizzle-orm");
    const db = await m.connect.getDb();
    const app = await db.query.brandSellerApplications.findFirst({ where: eq(m.t.brandSellerApplications.userId, applicantId) });
    await expect(m.onboarding.approveBrandApplication({ applicationId: app!.id, slug: "join", brandName: "Hina Label", reviewerId: staffId })).rejects.toThrow(/reserved/);
    const r = await m.onboarding.approveBrandApplication({ applicationId: app!.id, slug: "hina-label", brandName: "Hina Label", reviewerId: staffId });
    brandId = r.brand.id;
    expect(r.brand).toMatchObject({ partnership: "authorised", permissionGrantedById: applicantId, isActive: true });
    expect(r.brand.permissionNote).toMatch(/accepted the Wahbayaan brand seller terms/);
    expect(m.vis.isBrandPublic(r.brand, { demoMode: false })).toBe(true);
    const user = await db.query.users.findFirst({ where: eq(m.t.users.id, applicantId) });
    expect(user!.role).toBe("seller");
    const member = await db.query.brandMembers.findFirst({ where: eq(m.t.brandMembers.userId, applicantId) });
    expect(member!.brandId).toBe(brandId);
    const profile = await db.query.brandProfiles.findFirst({ where: eq(m.t.brandProfiles.brandId, brandId) });
    expect(profile).toMatchObject({ selfListed: true, socials: { instagram: "https://instagram.com/hinalabel" } });
    await expect(m.onboarding.approveBrandApplication({ applicationId: app!.id, slug: "hina-label", brandName: "Hina Label", reviewerId: staffId })).rejects.toThrow(/Already approved/);
  });
});

describe("brand portal CSV import", () => {
  it("previews without writing, with row-level errors", async () => {
    const db = await m.connect.getDb();
    const p = await m.imp.previewBrandImport(brandId, CSV);
    expect(p.refused).toBeNull();
    expect(p.plan!.counts).toMatchObject({ productsCreate: 2, variantsCreate: 3, skipped: 1 });
    expect(p.validated.errors).toEqual([expect.objectContaining({ line: 5, column: "price_pkr" })]);
    expect(await db.select().from(m.t.brandProducts)).toHaveLength(0);
  });

  it("imports, then re-importing the same file changes nothing (idempotent by SKU)", async () => {
    const { eq } = await import("drizzle-orm");
    const db = await m.connect.getDb();
    const first = await m.imp.runBrandImport(brandId, CSV, applicantId);
    expect(first.ok).toBe(true);
    const products = await db.select().from(m.t.brandProducts).where(eq(m.t.brandProducts.brandId, brandId));
    expect(products.map((p) => p.title).sort()).toEqual(["Noor Kurta", "Zara Lawn 2-Piece"]);
    const zara = products.find((p) => p.externalId === "zara-lawn")!;
    expect(zara).toMatchObject({ status: "published", pricePkr: 549000, weightG: 800, audience: "women" });
    const kurta = products.find((p) => p.externalId === "noor-kurta")!;
    expect(kurta).toMatchObject({ status: "draft", pricePkr: 390000, compareAtPricePkr: 450000 });
    const variants = await db.select().from(m.t.brandProductVariants);
    expect(variants).toHaveLength(3);
    expect(variants.find((v) => v.sku === "ZL-ROSE-M")).toMatchObject({ stockQty: 0, available: false });
    expect(await db.select().from(m.t.brandProductImages)).toHaveLength(3);

    const again = await m.imp.runBrandImport(brandId, CSV, applicantId);
    expect(again.ok && again.plan.counts).toMatchObject({ productsCreate: 0, productsUpdate: 0, productsUnchanged: 2, variantsCreate: 0, variantsUpdate: 0, variantsUnchanged: 3 });
    expect(await db.select().from(m.t.brandProducts)).toHaveLength(2);
    expect(await db.select().from(m.t.brandProductVariants)).toHaveLength(3);
    expect(await db.select().from(m.t.brandProductImages)).toHaveLength(3);
    const ids = (await db.select({ id: m.t.brandProductVariants.id }).from(m.t.brandProductVariants)).map((v) => v.id).sort();
    expect(ids).toEqual(variants.map((v) => v.id).sort());

    // Stock change + a new size: one update, one insert, same variant ids kept.
    const edited = CSV.replace("ZL-ROSE-M,5490,,0", "ZL-ROSE-M,5490,,6").replace("broken,Broken Item,,women,,,,,,S,,BR-S,not-a-price", "zara-lawn,,,,,,,,,L,Rose,ZL-ROSE-L,5990");
    const third = await m.imp.runBrandImport(brandId, edited, applicantId);
    expect(third.ok && third.plan.counts).toMatchObject({ productsUpdate: 1, variantsUpdate: 1, variantsCreate: 1, skipped: 0 });
    const m2 = await db.query.brandProductVariants.findFirst({ where: eq(m.t.brandProductVariants.sku, "ZL-ROSE-M") });
    expect(m2).toMatchObject({ id: variants.find((v) => v.sku === "ZL-ROSE-M")!.id, stockQty: 6, available: true });
    const runs = await db.select().from(m.t.brandSyncRuns).where(eq(m.t.brandSyncRuns.brandId, brandId));
    expect(runs.map((r) => r.trigger)).toEqual(["portal", "portal", "portal"]);
  });

  it("refuses to import once the permission is revoked", async () => {
    const { eq } = await import("drizzle-orm");
    const db = await m.connect.getDb();
    const before = await db.query.brands.findFirst({ where: eq(m.t.brands.id, brandId) });
    await db.update(m.t.brands).set({ permissionGrantedAt: null, permissionGrantedById: null, permissionNote: null, partnership: "none" }).where(eq(m.t.brands.id, brandId));
    const r = await m.imp.runBrandImport(brandId, CSV, applicantId);
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/No permission is recorded/) });
    const p = await m.imp.previewBrandImport(brandId, CSV);
    expect(p.refused).toMatch(/No permission/);
    await db.update(m.t.brands).set({ permissionGrantedAt: before!.permissionGrantedAt, permissionGrantedById: before!.permissionGrantedById, permissionNote: before!.permissionNote, partnership: "authorised" }).where(eq(m.t.brands.id, brandId));
  });
});

describe("fulfil hook", () => {
  it("marks paid items ready, scoped to the brand, and notifies listeners", async () => {
    const { eq } = await import("drizzle-orm");
    const db = await m.connect.getDb();
    const variant = await db.query.brandProductVariants.findFirst({ where: eq(m.t.brandProductVariants.sku, "ZL-ROSE-S") });
    const [order] = await db
      .insert(m.t.orders)
      .values({
        number: "WB-TEST-1",
        kind: "brand",
        brandFlow: "catalogue",
        email: "b@test.local",
        customerName: "B",
        currency: "PKR",
        fxPkrPerUnit: "1",
        fxSource: "test",
        destinationCountry: "PK",
        shippingAddress: { fullName: "B", line1: "1", city: "Lahore", country: "PK" },
        status: "awaiting_payment",
        itemsSubtotal: 549000,
        total: 549000,
      })
      .returning();
    const [item] = await db
      .insert(m.t.brandOrderItems)
      .values({ orderId: order.id, brandId, productId: variant!.productId, variantId: variant!.id, brandName: "Hina Label", title: "Zara Lawn 2-Piece", size: "S", colour: "Rose", sku: "ZL-ROSE-S", qty: 1, unitPricePkr: 549000, unitPrice: 549000 })
      .returning();
    await expect(m.fulfil.markBrandItemsReady({ brandId, orderItemIds: [item.id], actorUserId: applicantId })).rejects.toThrow(/isn't paid/);
    await db.update(m.t.orders).set({ status: "paid" }).where(eq(m.t.orders.id, order.id));
    await expect(m.fulfil.markBrandItemsReady({ brandId: "00000000-0000-4000-8000-000000000009", orderItemIds: [item.id], actorUserId: applicantId })).rejects.toThrow(/aren't from your brand/);
    const seen: string[] = [];
    const off = m.fulfil.onBrandItemsReady((e) => void seen.push(e.orderNumber));
    const e = await m.fulfil.markBrandItemsReady({ brandId, orderItemIds: [item.id], actorUserId: applicantId, note: "Packed" });
    off();
    expect(e.orderItemIds).toEqual([item.id]);
    expect(seen).toEqual(["WB-TEST-1"]);
    const ready = await db.select().from(m.t.brandItemReadiness);
    expect(ready).toEqual([expect.objectContaining({ orderItemId: item.id, brandId, markedById: applicantId, note: "Packed" })]);
    const events = await db.select().from(m.t.orderEvents).where(eq(m.t.orderEvents.orderId, order.id));
    expect(events[0]).toMatchObject({ kind: "brand_items_ready", visibleToBuyer: false });
  });
});
