/**
 * End-to-end order lifecycle against a throwaway embedded Postgres:
 * cart → order (awaiting quote, because no real rates exist) → staff quote →
 * payment held → artisan fulfilment → delivery → buyer confirms → funds
 * released → payout + certificate. Plus disputes (funds frozen → refund).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wb-it-"));
process.env.PGLITE_DIR = path.join(dir, "db");
process.env.DATABASE_URL = "";
process.env.DEMO_MODE = "true";

const jar = new Map<string, string>([
  ["wb_dest", "US"],
  ["wb_visitor", "it-visitor"],
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
  cart: typeof import("@/lib/commerce/cart");
  orders: typeof import("@/lib/commerce/orders");
  settings: typeof import("@/lib/settings");
};
let m: Mods;

beforeAll(async () => {
  m = {
    connect: await import("@/lib/db/connect"),
    t: await import("@/lib/db/schema"),
    cart: await import("@/lib/commerce/cart"),
    orders: await import("@/lib/commerce/orders"),
    settings: await import("@/lib/settings"),
  };
  const seed = await import("../../scripts/seed");
  const db = await m.connect.getDb();
  await seed.seedBase(db);
  await seed.seedDemo(db);
});

afterAll(async () => {
  await m.connect.closeDb();
  fs.rmSync(dir, { recursive: true, force: true });
});

async function addToCart(slugPart: string) {
  const { eq, like } = await import("drizzle-orm");
  const db = await m.connect.getDb();
  const [p] = await db.select().from(m.t.products).where(like(m.t.products.slug, `%${slugPart}%`));
  const c = await m.cart.getOrCreateCart("visitor:it-visitor");
  await db.delete(m.t.cartItems).where(eq(m.t.cartItems.cartId, c.id));
  await db.insert(m.t.cartItems).values({ cartId: c.id, productId: p.id, qty: 1 });
  return p;
}

const address = { fullName: "Test Buyer", line1: "1 Test St", city: "Springfield", region: "IL", postalCode: "62701", country: "US" };

describe("order lifecycle", () => {
  it("places an order that waits for a quote while rates are pending, then completes and pays out", async () => {
    const { eq } = await import("drizzle-orm");
    const db = await m.connect.getDb();
    const product = await addToCart("stupa-niche");
    const stockBefore = product.stockQty;

    const view = await m.cart.loadCart();
    expect(view.lines).toHaveLength(1);
    expect(view.landed?.complete).toBe(false);
    expect(view.landed?.lines.find((l) => l.key === "shipping")?.status).toBe("pending");

    const order = await m.orders.placeOrder({ cart: view, userId: null, email: "it@example.test", customerName: "Test Buyer", address });
    expect(order.status).toBe("awaiting_quote");
    expect(order.currency).toBe("USD");
    expect(order.totalComplete).toBe(false);
    const reserved = await db.query.products.findFirst({ where: eq(m.t.products.id, product.id) });
    expect(reserved!.stockQty).toBe(Math.max(stockBefore - 1, 0));
    expect((await m.cart.loadCart()).lines).toHaveLength(0);

    await expect(m.orders.beginPayment(order.number, "http://test")).rejects.toThrow(/isn't ready/);

    const staff = await db.query.users.findFirst({ where: eq(m.t.users.email, "admin@wahbayaan.test") });
    await m.orders.sendQuote(order.id, { shipping: 120_00, duty: 0, importTax: null, handling: null, note: "Quoted" }, staff!.id);
    const quoted = await db.query.orders.findFirst({ where: eq(m.t.orders.id, order.id) });
    expect(quoted!.status).toBe("quote_sent");
    expect(quoted!.total).toBe(order.itemsSubtotal + 120_00);

    const start = await m.orders.beginPayment(order.number, "http://test");
    expect(start.provider).toBe("test");
    await m.orders.markPaid(order.id, start.providerRef);
    const paid = await db.query.orders.findFirst({ where: eq(m.t.orders.id, order.id), with: { vendorOrders: true } });
    expect(paid!.status).toBe("paid");
    expect(paid!.fundsState).toBe("held");

    const vo = paid!.vendorOrders[0];
    const actor = { userId: staff!.id, isStaff: true };
    await m.orders.vendorOrderAction(vo.id, { type: "accept" }, actor);
    expect((await db.query.orders.findFirst({ where: eq(m.t.orders.id, order.id) }))!.status).toBe("in_fulfilment");
    await m.orders.vendorOrderAction(vo.id, { type: "ship", courier: "DHL Express", trackingNumber: "IT123" }, actor);
    expect((await db.query.orders.findFirst({ where: eq(m.t.orders.id, order.id) }))!.status).toBe("shipped");
    await m.orders.vendorOrderAction(vo.id, { type: "delivered" }, actor);
    const delivered = await db.query.orders.findFirst({ where: eq(m.t.orders.id, order.id) });
    expect(delivered!.status).toBe("delivered");
    expect(delivered!.autoReleaseAt).toBeTruthy();

    // With the commission rate set, release creates a PKR payout and a certificate.
    await m.settings.setSetting("commission", { status: "active", defaultBps: 1500 });
    await m.orders.releaseFunds(order.id, { userId: null, reason: "test" });
    const done = await db.query.orders.findFirst({ where: eq(m.t.orders.id, order.id), with: { vendorOrders: true, items: true } });
    expect(done!.status).toBe("completed");
    expect(done!.fundsState).toBe("released");
    const net = done!.vendorOrders[0].netPkr!;
    expect(net).toBe(done!.vendorOrders[0].subtotalPkr - Math.round(done!.vendorOrders[0].subtotalPkr * 0.15));
    const payout = await db.query.payouts.findFirst({ where: eq(m.t.payouts.id, done!.vendorOrders[0].payoutId!) });
    expect(payout!.amountPkr).toBe(net);
    expect(done!.items[0].certificateId).toBeTruthy();
  });

  it("freezes funds when a case is opened and refunds on resolution", async () => {
    const { eq } = await import("drizzle-orm");
    const db = await m.connect.getDb();
    await addToCart("salt-tealight");
    const buyer = await db.query.users.findFirst({ where: eq(m.t.users.email, "buyer@wahbayaan.test") });
    const order = await m.orders.placeOrder({ cart: await m.cart.loadCart(), userId: buyer!.id, email: buyer!.email, customerName: buyer!.name, address });
    const staff = await db.query.users.findFirst({ where: eq(m.t.users.email, "admin@wahbayaan.test") });
    await m.orders.sendQuote(order.id, { shipping: 40_00, duty: 0, importTax: null, handling: null }, staff!.id);
    const start = await m.orders.beginPayment(order.number, "http://test");
    await m.orders.markPaid(order.id, start.providerRef);

    const caseNo = await m.orders.openDispute(order.number, buyer!.id, { reason: "damaged", description: "Arrived cracked", evidenceUrls: [] });
    const frozen = await db.query.orders.findFirst({ where: eq(m.t.orders.id, order.id) });
    expect(frozen!.status).toBe("disputed");
    expect(frozen!.fundsState).toBe("frozen");
    await expect(m.orders.openDispute(order.number, buyer!.id, { reason: "damaged", description: "again", evidenceUrls: [] })).rejects.toThrow(/already an open case/);

    const dispute = await db.query.disputes.findFirst({ where: eq(m.t.disputes.number, caseNo) });
    await m.orders.resolveDispute(dispute!.id, staff!.id, { resolution: "refund", note: "Refunded in full" });
    const refunded = await db.query.orders.findFirst({ where: eq(m.t.orders.id, order.id), with: { refunds: true } });
    expect(refunded!.status).toBe("refunded");
    expect(refunded!.paymentStatus).toBe("refunded");
    expect(refunded!.refunds.reduce((a, r) => a + r.amount, 0)).toBe(refunded!.total);
  });

  it("refuses an order whose address is outside the estimated destination", async () => {
    await addToCart("salt-tealight");
    await expect(m.orders.placeOrder({ cart: await m.cart.loadCart(), userId: null, email: "x@example.test", customerName: "X", address: { ...address, country: "GB" } })).rejects.toThrow(/destination/);
  });
});
