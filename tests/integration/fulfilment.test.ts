/**
 * Fulfilment against a throwaway embedded Postgres: routing on payment, direct
 * domestic parcels (book → hand over), hub consolidation for an international
 * order (send to hub → receive → QC → pack & ship → delivered) with escrow
 * untouched, partial-shipment guard and a return request.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "wb-ff-"));
process.env.PGLITE_DIR = path.join(dir, "db");
process.env.DATABASE_URL = "";
process.env.DEMO_MODE = "true";

const jar = new Map<string, string>([
  ["wb_dest", "US"],
  ["wb_visitor", "ff-visitor"],
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
  ff: typeof import("@/lib/fulfilment/service");
};
let m: Mods;
let staffId: string;
const SANDBOX = "Sandbox Courier (demo)";

beforeAll(async () => {
  m = {
    connect: await import("@/lib/db/connect"),
    t: await import("@/lib/db/schema"),
    cart: await import("@/lib/commerce/cart"),
    orders: await import("@/lib/commerce/orders"),
    ff: await import("@/lib/fulfilment/service"),
  };
  const seed = await import("../../scripts/seed");
  const db = await m.connect.getDb();
  await seed.seedBase(db);
  await seed.seedDemo(db);
  const { eq } = await import("drizzle-orm");
  const [admin] = await db.select().from(m.t.users).where(eq(m.t.users.email, "admin@wahbayaan.test"));
  staffId = admin.id;
});

afterAll(async () => {
  await m.connect.closeDb();
  fs.rmSync(dir, { recursive: true, force: true });
});

async function order(dest: string, slugs: string[], address: { city: string; country: string }) {
  const { eq, like } = await import("drizzle-orm");
  jar.set("wb_dest", dest);
  const db = await m.connect.getDb();
  const c = await m.cart.getOrCreateCart("visitor:ff-visitor");
  await db.delete(m.t.cartItems).where(eq(m.t.cartItems.cartId, c.id));
  for (const s of slugs) {
    const [p] = await db.select().from(m.t.products).where(like(m.t.products.slug, `%${s}%`));
    await db.insert(m.t.cartItems).values({ cartId: c.id, productId: p.id, qty: 1 });
  }
  const view = await m.cart.loadCart({ city: address.city });
  const o = await m.orders.placeOrder({ cart: view, userId: null, email: "ff@example.test", customerName: "FF Buyer", address: { fullName: "FF Buyer", line1: "1 Test St", ...address } });
  await m.orders.sendQuote(o.id, { shipping: 4000, duty: dest === "PK" ? 0 : 500, importTax: null, handling: null }, staffId);
  await m.orders.markPaid(o.id, null);
  return { o, view };
}

const staff = () => ({ userId: staffId, isStaff: true });

describe("fulfilment", () => {
  it("domestic: one parcel per seller, booked and handed over separately", async () => {
    const { o, view } = await order("PK", ["mohabbat", "classic-ajrak"], { city: "Lahore", country: "PK" });
    expect(view.plan?.mode).toBe("direct");
    expect(view.plan?.parcels.map((p) => p.sellerCity).sort()).toEqual(["Hala", "Lahore"]);
    // No domestic rates exist: delivery stays pending (never zero).
    expect(view.landed?.lines.find((l) => l.key === "shipping")).toMatchObject({ status: "pending", amount: null, label: "Delivery within Pakistan (2 parcels)" });
    const v0 = await m.ff.getOrderFulfilmentView(o.id);
    expect(v0.fulfilment?.mode).toBe("direct");
    expect(v0.parcels).toHaveLength(0);
    const { eq } = await import("drizzle-orm");
    const db = await m.connect.getDb();
    const vos = await db.select().from(m.t.vendorOrders).where(eq(m.t.vendorOrders.orderId, o.id));
    const a = await m.ff.bookDirectParcel(vos[0].id, staff(), { courierName: SANDBOX, useAdapter: true });
    expect(a.trackingNumber).toMatch(/^SBX/);
    const b = await m.ff.bookDirectParcel(vos[1].id, staff(), { courierName: "TCS", useAdapter: false, trackingNumber: "TCS1234567" });
    expect(b.provider).toBe("manual");
    await expect(m.ff.bookDirectParcel(vos[1].id, staff(), { courierName: "TCS", useAdapter: true })).rejects.toThrow(/booked manually/);
    await m.ff.handOverDirectParcel(a.id, staff());
    let o2 = await db.query.orders.findFirst({ where: eq(m.t.orders.id, o.id) });
    expect(o2?.status).toBe("in_fulfilment");
    await m.ff.handOverDirectParcel(b.id, staff());
    o2 = await db.query.orders.findFirst({ where: eq(m.t.orders.id, o.id) });
    expect(o2?.status).toBe("shipped");
    const v = await m.ff.getOrderFulfilmentView(o.id);
    expect(v.shipments.map((s) => s.status)).toEqual(["shipped", "shipped"]);
  });

  it("international: consolidated at the active hub, one box, escrow unchanged", async () => {
    const { eq } = await import("drizzle-orm");
    const db = await m.connect.getDb();
    await db.update(m.t.hubs).set({ isActive: true }).where(eq(m.t.hubs.name, "Demo Hub (Lahore)"));
    const { o, view } = await order("US", ["badshahi-skyline", "salt-tealight"], { city: "New York", country: "US" });
    expect(view.plan?.mode).toBe("hub");
    let v = await m.ff.getOrderFulfilmentView(o.id);
    expect(v.fulfilment?.mode).toBe("hub");
    expect(v.parcels).toHaveLength(2);
    expect(v.progress.label).toBe("0 of 2 items arrived");
    expect(v.fulfilment?.estimatedDispatchAt).toBeInstanceOf(Date); // slowest dispatch + 2 hub days

    const [p1, p2] = v.parcels;
    await expect(m.ff.bookDirectParcel(p1.vendorOrderId!, staff(), { courierName: SANDBOX, useAdapter: true })).rejects.toThrow(/Send to hub/);
    const sent = await m.ff.sendParcelToHub(p1.vendorOrderId!, staff(), { method: "book", courierName: SANDBOX });
    expect(sent.trackingNumber).toMatch(/^SBX/);
    await m.ff.sendParcelToHub(p2.vendorOrderId!, staff(), { method: "drop_off" });

    expect((await m.ff.findParcel(p1.reference.toLowerCase()))?.id).toBe(p1.id);
    expect(await m.ff.findParcel(p1.reference.slice(0, -1) + "0")).toBeNull();
    expect((await m.ff.findParcel(sent.trackingNumber!))?.id).toBe(p1.id);

    const r1 = await m.ff.receiveParcel(p1.id, staff(), { weightG: 400 });
    expect(r1.progress.label).toBe("1 of 2 items arrived");
    await m.ff.receiveParcel(p2.id, staff());
    await expect(m.ff.receiveParcel(p2.id, staff())).rejects.toThrow(/already/);
    await expect(m.ff.qcParcel(p1.id, staff(), { result: "fail" })).rejects.toThrow(/Describe the problem/);
    await m.ff.qcParcel(p1.id, staff(), { result: "pass", bin: "A-01" });
    // Not everything is checked yet: a full box is refused, a partial needs a decision first.
    await expect(m.ff.packAndShip(o.id, staff(), { parcelIds: [p1.id], weightG: 500, lengthCm: 20, widthCm: 20, heightCm: 10, courierName: SANDBOX, useAdapter: true })).rejects.toThrow(/Ship ready items now/);
    await expect(m.ff.decideConsolidation(o.id, staff(), "ship_partial", null)).rejects.toThrow(/Nothing|late|slowest/);
    const progress = await m.ff.qcParcel(p2.id, staff(), { result: "pass", bin: "A-02" });
    expect(progress.readyToPack).toBe(true);

    const r = await m.ff.packAndShip(o.id, staff(), { parcelIds: [p1.id, p2.id], weightG: 1400, lengthCm: 40, widthCm: 30, heightCm: 20, courierName: SANDBOX, useAdapter: true });
    expect(r.partial).toBe(false);
    expect(r.chargeableG).toBe(4800);
    expect(r.rate).toBeNull(); // no active rate card → cost pending, never zero
    expect(r.shipment.documentItems).toHaveLength(2);
    let o2 = await db.query.orders.findFirst({ where: eq(m.t.orders.id, o.id), with: { vendorOrders: true } });
    expect(o2?.status).toBe("shipped");
    expect(new Set(o2?.vendorOrders.map((x) => x.trackingNumber))).toEqual(new Set([r.shipment.trackingNumber]));
    const emails = await db.select().from(m.t.emailOutbox).where(eq(m.t.emailOutbox.to, "ff@example.test"));
    expect(emails.filter((e) => (e.template === "shipped" || e.template === "hub_shipped") && e.subject.includes(o.number))).toHaveLength(1);

    await m.ff.markShipmentDelivered(r.shipment.id, staff());
    o2 = await db.query.orders.findFirst({ where: eq(m.t.orders.id, o.id), with: { vendorOrders: true } });
    expect(o2?.status).toBe("delivered");
    expect(o2?.fundsState).toBe("held");
    expect(o2?.autoReleaseAt).toBeInstanceOf(Date);
    v = await m.ff.getOrderFulfilmentView(o.id);
    expect(v.shipments[0].status).toBe("delivered");

    // Return: allowed while funds are held (protection window pending); goes back to the hub and pauses auto-release.
    const items = await db.select().from(m.t.orderItems).where(eq(m.t.orderItems.orderId, o.id));
    const ret = await m.ff.requestReturn(o.number, null as unknown as string, { items: [{ orderItemId: items[0].id, title: items[0].title, qty: 1 }], reason: "damaged", description: "Chipped on arrival, sorry", photos: [] }).catch((e) => e);
    expect(String(ret)).toMatch(/Order not found/); // guest orders can't request returns without the account
    await db.update(m.t.orders).set({ userId: staffId }).where(eq(m.t.orders.id, o.id));
    const ok = await m.ff.requestReturn(o.number, staffId, { items: [{ orderItemId: items[0].id, title: items[0].title, qty: 1 }], reason: "damaged", description: "Chipped on arrival, sorry", photos: [] });
    expect(ok.destination).toBe("hub");
    o2 = await db.query.orders.findFirst({ where: eq(m.t.orders.id, o.id), with: { vendorOrders: true } });
    expect(o2?.autoReleaseAt).toBeNull();
    await m.ff.decideReturn(ok.id, staff(), true, null);
    await m.ff.updateReturn(ok.id, staff(), { type: "received" });
    await m.ff.refundReturn(ok.id, staff(), 500);
    const after = await db.query.returnRequests.findFirst({ where: eq(m.t.returnRequests.id, ok.id) });
    expect(after?.status).toBe("refunded");
    expect(after?.refundId).toBeTruthy();
  });

  it("extra shipping is charged only after the buyer approves and pays", async () => {
    const { eq } = await import("drizzle-orm");
    const db = await m.connect.getDb();
    const { o } = await order("US", ["lakeside-mosque"], { city: "Boston", country: "US" });
    await db.update(m.t.orders).set({ userId: staffId }).where(eq(m.t.orders.id, o.id));
    const before = (await db.query.orders.findFirst({ where: eq(m.t.orders.id, o.id) }))!;
    const q = await m.ff.createFulfilmentQuote(o.id, staff(), { kind: "partial_shipment", amount: 1250 });
    expect((await db.query.orders.findFirst({ where: eq(m.t.orders.id, o.id) }))!.total).toBe(before.total);
    await expect(m.ff.markFulfilmentQuotePaid(q.id)).rejects.toThrow(/wasn't approved/);
    const url = await m.ff.payFulfilmentQuote(q.id, staffId, "http://localhost");
    expect(url).toBe(`/checkout/test-payment/extra?quote=${q.id}`);
    await m.ff.markFulfilmentQuotePaid(q.id);
    const paid = (await db.query.orders.findFirst({ where: eq(m.t.orders.id, o.id) }))!;
    expect(paid.total).toBe(before.total + 1250);
  });
});
