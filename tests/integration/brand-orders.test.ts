/**
 * Pakistani Brands orders against a throwaway embedded Postgres with the demo
 * seed (fictional brands): a domestic PKR order (no duty, pending delivery
 * never zero, staff quote, payment, fulfilment checklist), a gift to Pakistan
 * paid in USD, a link request priced by staff, payment-method gating and
 * "notify me" alerts.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wb-brand-orders-"));
process.env.PGLITE_DIR = path.join(dir, "db");
process.env.DATABASE_URL = "";
process.env.DEMO_MODE = "true";

const jar = new Map<string, string>([
  ["wb_dest", "PK"],
  ["wb_visitor", "brand-visitor"],
]);
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
  headers: async () => new Headers(),
}));

type Mods = {
  connect: typeof import("@/lib/db/connect");
  t: typeof import("@/lib/db/schema");
  bag: typeof import("@/lib/brands/bag");
  orders: typeof import("@/lib/brands/orders");
  core: typeof import("@/lib/commerce/orders");
  alerts: typeof import("@/lib/brands/alerts");
};
let m: Mods;
let staffId = "";
const address = { fullName: "Test Buyer", line1: "House 1", city: "Lahore", region: "Punjab", postalCode: null, country: "PK", phone: "+92 300 0000000" };

beforeAll(async () => {
  m = {
    connect: await import("@/lib/db/connect"),
    t: await import("@/lib/db/schema"),
    bag: await import("@/lib/brands/bag"),
    orders: await import("@/lib/brands/orders"),
    core: await import("@/lib/commerce/orders"),
    alerts: await import("@/lib/brands/alerts"),
  };
  const seed = await import("../../scripts/seed");
  const db = await m.connect.getDb();
  await seed.seedBase(db);
  await seed.seedDemo(db);
  const { eq } = await import("drizzle-orm");
  staffId = (await db.query.users.findFirst({ where: eq(m.t.users.email, "admin@wahbayaan.test") }))!.id;
});

afterAll(async () => {
  await m.connect.closeDb();
  fs.rmSync(dir, { recursive: true, force: true });
});

async function putInBag(sku: string, qty = 1) {
  const { eq } = await import("drizzle-orm");
  const db = await m.connect.getDb();
  const v = await db.query.brandProductVariants.findFirst({ where: eq(m.t.brandProductVariants.sku, sku) });
  const owner = `visitor:${jar.get("wb_visitor")}`;
  const cart = await m.bag.getOrCreateBrandCart(owner);
  await db.delete(m.t.brandCartItems).where(eq(m.t.brandCartItems.cartId, cart.id));
  await db.insert(m.t.brandCartItems).values({ cartId: cart.id, variantId: v!.id, qty });
  return { cart, variant: v! };
}

describe("Pakistani Brands orders", () => {
  it("domestic order: PKR, no import duty, pending delivery stays pending, service fee from the owner's band", async () => {
    jar.set("wb_dest", "PK");
    jar.delete("wb_currency");
    const { variant } = await putInBag("NLH-UN-JG-WH");
    const bag = await m.bag.loadBrandBag();
    expect(bag.shipTo).toBe("PK");
    expect(bag.canChooseShipTo).toBe(false);
    const q = bag.quote!;
    expect(q.currency).toBe("PKR");
    expect(q.lines.find((l) => l.key === "items")!.amount).toBe(375_000);
    expect(q.lines.find((l) => l.key === "shipping")).toMatchObject({ status: "pending", amount: null });
    expect(q.lines.find((l) => l.key === "duty")!.status).toBe("not_applicable");
    expect(q.lines.find((l) => l.key === "service_fee")).toMatchObject({ status: "known", amount: 20_000 });

    // JazzCash has no merchant account → refused; card (test mode) works.
    await expect(m.orders.placeBrandOrder({ bag, userId: null, email: "pk@test.local", customerName: "PK Buyer", address, method: "jazzcash" })).rejects.toThrow(/Awaiting merchant account/);
    const order = await m.orders.placeBrandOrder({ bag, userId: null, email: "pk@test.local", customerName: "PK Buyer", address, method: "card" });
    expect(order).toMatchObject({ kind: "brand", brandFlow: "catalogue", currency: "PKR", destinationCountry: "PK", status: "awaiting_quote", shippingStatus: "pending", dutyStatus: "not_applicable", serviceFeeAmount: 20_000, total: 395_000, totalComplete: false });

    const { eq } = await import("drizzle-orm");
    const db = await m.connect.getDb();
    const after = await db.query.brandProductVariants.findFirst({ where: eq(m.t.brandProductVariants.id, variant.id) });
    expect(after!.stockQty).toBe(variant.stockQty! - 1);

    // The quote can't be sent while delivery is pending and no confirmed amount is entered.
    await expect(m.orders.sendBrandQuote(order.id, {}, staffId)).rejects.toThrow(/Shipping is still pending/);
    const total = await m.orders.sendBrandQuote(order.id, { shipping: 25_000 }, staffId);
    expect(total).toBe(420_000);

    await m.core.markPaid(order.id, null);
    await expect(m.orders.advanceBrandFulfilment(order.id, "all", { step: "dispatched", courier: "X", trackingNumber: "1" }, staffId)).rejects.toThrow(/first/);
    await m.orders.advanceBrandFulfilment(order.id, "all", { step: "ordered_from_brand", brandOrderRef: "B-1", purchaseCostPkr: 375_000 }, staffId);
    await m.orders.advanceBrandFulfilment(order.id, "all", { step: "received_at_wahbayaan" }, staffId);
    await m.orders.advanceBrandFulfilment(order.id, "all", { step: "quality_checked" }, staffId);
    await m.orders.advanceBrandFulfilment(order.id, "all", { step: "dispatched", courier: "Demo Courier", trackingNumber: "TRK1" }, staffId);
    let o = await db.query.orders.findFirst({ where: eq(m.t.orders.id, order.id) });
    expect(o!.status).toBe("shipped");
    await m.orders.advanceBrandFulfilment(order.id, "all", { step: "delivered" }, staffId);
    o = await db.query.orders.findFirst({ where: eq(m.t.orders.id, order.id) });
    expect(o!.status).toBe("delivered");
    await m.core.releaseFunds(order.id, { userId: staffId, reason: "test" });
    o = await db.query.orders.findFirst({ where: eq(m.t.orders.id, order.id) });
    expect(o!.status).toBe("completed");
  });

  it("gift to Pakistan from the US: domestic delivery, no duty, paid in USD", async () => {
    jar.set("wb_dest", "US");
    const { cart } = await putInBag("NLH-KT-TM-S");
    const { eq } = await import("drizzle-orm");
    const db = await m.connect.getDb();
    let bag = await m.bag.loadBrandBag();
    expect(bag.shipTo).toBe("US");
    expect(bag.quote!.lines.find((l) => l.key === "duty")!.status).toBe("pending");
    await db.update(m.t.brandCarts).set({ shipTo: "PK" }).where(eq(m.t.brandCarts.id, cart.id));
    bag = await m.bag.loadBrandBag();
    expect(bag).toMatchObject({ shipTo: "PK", giftToPakistan: true });
    expect(bag.quote!.currency).toBe("USD");
    expect(bag.quote!.lines.find((l) => l.key === "shipping")).toMatchObject({ label: "Delivery within Pakistan", status: "pending" });
    expect(bag.quote!.lines.find((l) => l.key === "duty")!.status).toBe("not_applicable");
    const order = await m.orders.placeBrandOrder({ bag, userId: null, email: "us@test.local", customerName: "US Buyer", address, method: "card", giftMessage: "Eid Mubarak" });
    expect(order).toMatchObject({ currency: "USD", destinationCountry: "PK", isGift: true, giftMessage: "Eid Mubarak" });
    // An address outside Pakistan is refused for a gift-to-Pakistan bag.
    await putInBag("NLH-KT-TM-S");
    await expect(m.orders.placeBrandOrder({ bag: await m.bag.loadBrandBag(), userId: null, email: "us@test.local", customerName: "US Buyer", address: { ...address, country: "US" }, method: "card" })).rejects.toThrow(/Pakistan/);
  });

  it("link request: staff price the items; the quote uses the same fee and engine", async () => {
    jar.set("wb_dest", "PK");
    const req = await m.orders.createLinkRequest({
      items: [
        { url: "https://brand-one.pk/p/1", domain: "brand-one.pk", productName: "Lawn suit", brandName: "Brand One", size: "M", colour: null, qty: 1, notes: null },
        { url: "https://brand-two.pk/p/2", domain: "brand-two.pk", productName: "Kurta", brandName: "Brand Two", size: "L", colour: null, qty: 1, notes: null },
      ],
      shipTo: "PK",
      userId: null,
      email: "req@test.local",
      customerName: "Req Buyer",
      address,
      method: "card",
    });
    expect(req).toMatchObject({ brandFlow: "link_request", status: "awaiting_quote", total: 0, totalComplete: false });
    const { eq } = await import("drizzle-orm");
    const db = await m.connect.getDb();
    const items = await db.select().from(m.t.brandOrderItems).where(eq(m.t.brandOrderItems.orderId, req.id));
    expect(items.every((i) => i.unitPricePkr == null)).toBe(true);
    let r = await m.orders.priceBrandOrder(req.id, [{ id: items[0].id, unitPricePkr: 200_000, weightG: 500, unavailable: false, staffNote: null }]);
    expect(r.ready.ok).toBe(false);
    r = await m.orders.priceBrandOrder(req.id, [
      { id: items[0].id, unitPricePkr: 200_000, weightG: 500, unavailable: false, staffNote: null },
      { id: items[1].id, unitPricePkr: 160_000, weightG: 400, unavailable: false, staffNote: null },
    ]);
    expect(r.ready.ok).toBe(true);
    // Rs 3,600 falls in the owner's Rs 3,500–4,000 band → Rs 200; delivery pending (no zones set).
    expect(r.quote!.lines.map((l) => [l.key, l.status, l.amount])).toEqual([
      ["items", "known", 360_000],
      ["shipping", "pending", null],
      ["duty", "not_applicable", null],
      ["service_fee", "known", 20_000],
    ]);
    const total = await m.orders.sendBrandQuote(req.id, { shipping: 30_000 }, staffId);
    expect(total).toBe(410_000);
  });

  it("queues a restock alert email once the product is buyable", async () => {
    const { eq } = await import("drizzle-orm");
    const db = await m.connect.getDb();
    const product = await db.query.brandProducts.findFirst({ where: eq(m.t.brandProducts.slug, "noor-lawn-house-embroidered-kurta-teal-mehndi") });
    const brand = await db.query.brands.findFirst({ where: eq(m.t.brands.slug, "noor-lawn-house") });
    await db.insert(m.t.brandAlerts).values({ email: "alert@test.local", brandId: brand!.id, productId: product!.id, kind: "restock" });
    expect(await m.alerts.queueBrandAlerts(brand!.id)).toBe(1);
    const mail = await db.select().from(m.t.emailOutbox).where(eq(m.t.emailOutbox.to, "alert@test.local"));
    expect(mail[0].subject).toMatch(/Back in stock/);
    expect(await m.alerts.queueBrandAlerts(brand!.id)).toBe(0);
  });
});
