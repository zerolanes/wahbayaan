/**
 * Brand catalogue sync against a throwaway embedded Postgres, using the
 * recorded (fictional) fixtures in tests/fixtures/brands/. Checks that the
 * engine itself refuses to import without a recorded permission.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wb-brand-"));
process.env.PGLITE_DIR = path.join(dir, "db");
process.env.DATABASE_URL = "";

type Mods = {
  connect: typeof import("@/lib/db/connect");
  t: typeof import("@/lib/db/schema");
  sync: typeof import("@/lib/brands/sync");
};
let m: Mods;
let brandId = "";
let staffId = "";
const noSleep = async () => {};

beforeAll(async () => {
  m = { connect: await import("@/lib/db/connect"), t: await import("@/lib/db/schema"), sync: await import("@/lib/brands/sync") };
  const seed = await import("../../scripts/seed");
  const db = await m.connect.getDb();
  await seed.seedBase(db);
  const [staff] = await db.insert(m.t.users).values({ email: "ops@test.local", name: "Ops", role: "staff" }).returning();
  staffId = staff.id;
  const [brand] = await db
    .insert(m.t.brands)
    .values({ slug: "sahil-menswear", name: "Sahil Menswear", websiteUrl: "https://sahil-menswear.example", audiences: ["men"], isDemo: true })
    .returning();
  brandId = brand.id;
  await db.insert(m.t.brandSources).values({ brandId, type: "shopify_json", config: { url: "fixture:sahil-menswear", rateLimitMs: 1000 } });
});

afterAll(async () => {
  await m.connect.closeDb();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("brand sync", () => {
  it("refuses to import without recorded permission — even when sync was switched on directly in the database", async () => {
    const { eq } = await import("drizzle-orm");
    const db = await m.connect.getDb();
    await db.update(m.t.brandSources).set({ syncEnabled: true }).where(eq(m.t.brandSources.brandId, brandId));
    const r = await m.sync.runBrandSync(brandId, { trigger: "admin", actorUserId: staffId, sleep: noSleep });
    expect(r.status).toBe("refused");
    expect(r.errors[0]).toMatch(/No permission is recorded/);
    expect(await db.select().from(m.t.brandProducts)).toHaveLength(0);
    const runs = await db.select().from(m.t.brandSyncRuns);
    expect(runs).toHaveLength(1);
    expect(runs[0].status).toBe("refused");
    const audits = await db.select().from(m.t.auditLog).where(eq(m.t.auditLog.action, "brand.sync_refused"));
    expect(audits).toHaveLength(1);
    // The cron path is refused too.
    const cron = await m.sync.runScheduledBrandSyncs({ sleep: noSleep });
    expect(cron).toEqual([{ brandId, status: "refused", added: 0, updated: 0, failed: 0 }]);
  });

  it("imports from the fixture as drafts once permission is recorded, then skips unchanged products", async () => {
    const { eq } = await import("drizzle-orm");
    const db = await m.connect.getDb();
    await db
      .update(m.t.brands)
      .set({ permissionGrantedAt: new Date(), permissionGrantedById: staffId, permissionNote: "Test permission (fictional brand)" })
      .where(eq(m.t.brands.id, brandId));

    const first = await m.sync.runBrandSync(brandId, { trigger: "admin", actorUserId: staffId, sleep: noSleep });
    expect(first).toMatchObject({ status: "partial", added: 3, updated: 0, unchanged: 0, failed: 1 });
    expect(first.errors[0]).toMatch(/Gift Card/);

    const products = await db.query.brandProducts.findMany({ with: { variants: true, images: true } });
    expect(products).toHaveLength(3);
    expect(products.every((p) => p.status === "draft")).toBe(true);
    const kurta = products.find((p) => p.title === "Ivory Cotton Kurta Shalwar")!;
    expect(kurta.slug).toBe("sahil-menswear-ivory-cotton-kurta-shalwar");
    expect(kurta.variants).toHaveLength(6);
    expect(kurta.images[0].kind).toBe("illustration");
    expect(kurta.sourceUrl).toBe("https://sahil-menswear.example/products/ivory-cotton-kurta-shalwar");

    // Staff publish and override a price; a re-sync must not undo that.
    await db.update(m.t.brandProducts).set({ status: "published", priceOverridePkr: 330_000 }).where(eq(m.t.brandProducts.id, kurta.id));
    const second = await m.sync.runBrandSync(brandId, { trigger: "cron", actorUserId: null, sleep: noSleep });
    expect(second).toMatchObject({ added: 0, updated: 0, unchanged: 3 });
    const after = await db.query.brandProducts.findFirst({ where: eq(m.t.brandProducts.id, kurta.id) });
    expect(after?.status).toBe("published");
    expect(after?.priceOverridePkr).toBe(330_000);

    const runs = await db.select().from(m.t.brandSyncRuns).where(eq(m.t.brandSyncRuns.brandId, brandId));
    expect(runs.map((r) => r.status).sort()).toEqual(["partial", "partial", "refused", "refused"]);
  });

  it("refuses again when permission is revoked", async () => {
    const { eq } = await import("drizzle-orm");
    const db = await m.connect.getDb();
    await db.update(m.t.brands).set({ permissionGrantedAt: null, permissionGrantedById: null, permissionNote: null }).where(eq(m.t.brands.id, brandId));
    const r = await m.sync.runBrandSync(brandId, { trigger: "admin", actorUserId: staffId, sleep: noSleep });
    expect(r.status).toBe("refused");
  });

  it("imports a CSV feed upload for a csv_feed source with permission", async () => {
    const db = await m.connect.getDb();
    const [b] = await db
      .insert(m.t.brands)
      .values({ slug: "noor-lawn-house", name: "Noor Lawn House", audiences: ["women"], permissionGrantedAt: new Date(), permissionGrantedById: staffId, permissionNote: "Feed supplied by the (fictional) brand" })
      .returning();
    await db.insert(m.t.brandSources).values({ brandId: b.id, type: "csv_feed" });
    const csv = fs.readFileSync(path.join(__dirname, "../fixtures/brands/noor-lawn-house-feed.csv"), "utf8");
    const r = await m.sync.runBrandSync(b.id, { trigger: "upload", actorUserId: staffId, csvText: csv });
    expect(r).toMatchObject({ status: "partial", added: 2, failed: 1 });
  });
});
