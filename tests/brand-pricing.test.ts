import { describe, expect, it } from "vitest";
import { buildTrackingUrl, DEFAULT_DOMESTIC_DELIVERY, quoteDomestic, zoneForCity, type DomesticRate } from "@/lib/brands/domestic";
import { computeServiceFee, DEFAULT_BRAND_MARGIN, validateMarginRule, type MarginRule } from "@/lib/brands/margin";
import { computeBrandQuote, type BrandQuoteInput } from "@/lib/brands/pricing";
import { brandFromDomain, parseRequestItems, requestReadyToQuote, validateProductUrl } from "@/lib/brands/requests";
import { availableMethods, DEFAULT_PAYMENT_METHODS, methodAvailability } from "@/lib/payments/methods";
import type { FxQuote } from "@/lib/money/currency";

const PKR: FxQuote = { currency: "PKR", pkrPerUnit: 1, source: "identity", status: "live" };
const USD: FxQuote = { currency: "USD", pkrPerUnit: 280, source: "test", status: "manual" };

describe("Wahbayaan service fee (brand_margin)", () => {
  const domestic = DEFAULT_BRAND_MARGIN.domestic;

  it("pre-fills the owner's example: Rs 100–200 on a Rs 3,000–4,000 domestic order", () => {
    expect(computeServiceFee(domestic, 300_000)).toMatchObject({ status: "known", feePkr: 10_000 });
    expect(computeServiceFee(domestic, 349_000)).toMatchObject({ status: "known", feePkr: 10_000 });
    expect(computeServiceFee(domestic, 375_000)).toMatchObject({ status: "known", feePkr: 20_000 });
    expect(computeServiceFee(domestic, 400_000)).toMatchObject({ status: "known", feePkr: 20_000 });
    expect(domestic.note).toMatch(/Owner's starting point/);
  });

  it("is pending — never zero — outside every band and for international orders until set", () => {
    expect(computeServiceFee(domestic, 250_000).status).toBe("pending");
    expect(computeServiceFee(domestic, 500_000).status).toBe("pending");
    expect(computeServiceFee(DEFAULT_BRAND_MARGIN.international, 375_000)).toEqual({ status: "pending", reason: "service fee not yet set" });
  });

  it("supports percentage mode with minimum and maximum", () => {
    const rule: MarginRule = { status: "active", mode: "percent", tiers: [], percentBps: 500, minFeePkr: 15_000, maxFeePkr: 100_000, note: null };
    expect(computeServiceFee(rule, 1_000_000)).toMatchObject({ feePkr: 50_000 }); // 5% of Rs 10,000
    expect(computeServiceFee(rule, 100_000)).toMatchObject({ feePkr: 15_000 }); // min Rs 150
    expect(computeServiceFee(rule, 5_000_000)).toMatchObject({ feePkr: 100_000 }); // max Rs 1,000
  });

  it("uses the percentage as a fallback outside the bands in tiers mode", () => {
    const rule: MarginRule = { ...domestic, percentBps: 400, minFeePkr: null, maxFeePkr: null };
    expect(computeServiceFee(rule, 375_000)).toMatchObject({ feePkr: 20_000 });
    expect(computeServiceFee(rule, 1_000_000)).toMatchObject({ feePkr: 40_000 });
  });

  it("validates bands", () => {
    expect(validateMarginRule(domestic)).toBeNull();
    expect(validateMarginRule({ ...domestic, tiers: [{ minPkr: 0, maxPkr: 500_000, feePkr: 1 }, { minPkr: 400_000, maxPkr: null, feePkr: 2 }] })).toMatch(/overlap/);
    expect(validateMarginRule({ ...domestic, mode: "percent", percentBps: null })).toMatch(/percentage/);
  });
});

const zones = [
  { key: "major_cities", label: "Major cities", cities: ["Lahore", "Karachi"] },
  { key: "other", label: "Rest of Pakistan", cities: [] },
];
const rate = (over: Partial<DomesticRate>): DomesticRate => ({
  courier: "Courier A",
  serviceName: "Standard",
  zone: "major_cities",
  minWeightG: 0,
  maxWeightG: 3000,
  amount: 25_000,
  currency: "PKR",
  transitDaysMin: 2,
  transitDaysMax: 4,
  status: "active",
  ...over,
});

function input(over: Partial<BrandQuoteInput>): BrandQuoteInput {
  return {
    items: [{ key: "v1", title: "Lawn 3-piece", unitPricePkr: 375_000, qty: 1, weightG: 900 }],
    shipTo: "PK",
    city: null,
    fx: PKR,
    fxTable: { USD },
    margin: DEFAULT_BRAND_MARGIN,
    domestic: { setting: { ...DEFAULT_DOMESTIC_DELIVERY, zones }, rates: [] },
    international: { shippingRates: [], dutyRates: [] },
    ...over,
  };
}

describe("domestic landed cost (brand orders delivered in Pakistan)", () => {
  it("has no import duty and keeps pending shipping pending, never zero", () => {
    const q = computeBrandQuote(input({}));
    const line = (k: string) => q.lines.find((l) => l.key === k);
    expect(q.currency).toBe("PKR");
    expect(line("items")).toMatchObject({ status: "known", amount: 375_000 });
    expect(line("shipping")).toMatchObject({ label: "Delivery within Pakistan", status: "pending", amount: null });
    expect(line("shipping")!.note).toMatch(/delivery city/);
    expect(line("duty")).toMatchObject({ status: "not_applicable", amount: null });
    expect(line("import_tax")).toBeUndefined();
    expect(line("handling")).toBeUndefined();
    expect(line("service_fee")).toMatchObject({ label: "Wahbayaan service fee", status: "known", amount: 20_000 });
    expect(q.complete).toBe(false);
    expect(q.knownTotal).toBe(395_000);
  });

  it("prices delivery from the cheapest active rate of an active courier for the city's zone", () => {
    const rates = [rate({ amount: 30_000 }), rate({ courier: "Courier B", amount: 22_000 }), rate({ courier: "Off", amount: 1_000, courierActive: false }), rate({ zone: "other", amount: 50_000 })];
    const q = computeBrandQuote(input({ city: "lahore", domestic: { setting: { ...DEFAULT_DOMESTIC_DELIVERY, zones }, rates } }));
    expect(q.lines.find((l) => l.key === "shipping")).toMatchObject({ status: "known", amount: 22_000 });
    expect(q.complete).toBe(true);
    expect(q.knownTotal).toBe(375_000 + 22_000 + 20_000);
    const other = computeBrandQuote(input({ city: "Gilgit", domestic: { setting: { ...DEFAULT_DOMESTIC_DELIVERY, zones }, rates } }));
    expect(other.lines.find((l) => l.key === "shipping")).toMatchObject({ status: "known", amount: 50_000 });
  });

  it("gift to Pakistan from an overseas buyer: domestic delivery, no duty, priced in the buyer's USD", () => {
    const q = computeBrandQuote(input({ fx: USD, city: "Karachi", domestic: { setting: { ...DEFAULT_DOMESTIC_DELIVERY, zones }, rates: [rate({ amount: 28_000 })] } }));
    expect(q.currency).toBe("USD");
    expect(q.lines.find((l) => l.key === "items")!.amount).toBe(1339); // Rs 3,750 at 280
    expect(q.lines.find((l) => l.key === "shipping")).toMatchObject({ status: "known", amount: 100 });
    expect(q.lines.find((l) => l.key === "duty")!.status).toBe("not_applicable");
    expect(q.lines.find((l) => l.key === "service_fee")!.amount).toBe(71); // Rs 200
  });

  it("international brand orders reuse the cross-border engine: duty pending, fee pending until set", () => {
    const q = computeBrandQuote(input({ shipTo: "US", fx: USD }));
    expect(q.lines.find((l) => l.key === "shipping")).toMatchObject({ label: "International shipping", status: "pending" });
    expect(q.lines.find((l) => l.key === "duty")).toMatchObject({ status: "pending", amount: null });
    expect(q.lines.find((l) => l.key === "service_fee")).toMatchObject({ status: "pending", amount: null });
    expect(q.knownTotal).toBe(1339);
  });
});

describe("domestic zones, quotes and tracking links", () => {
  it("resolves zones only once cities are set up", () => {
    expect(zoneForCity(DEFAULT_DOMESTIC_DELIVERY.zones, "Lahore")).toBeNull();
    expect(zoneForCity(zones, " LAHORE ")!.key).toBe("major_cities");
    expect(zoneForCity(zones, "Hunza")!.key).toBe("other");
    expect(quoteDomestic({ ...DEFAULT_DOMESTIC_DELIVERY, zones }, [rate({ status: "pending", amount: null })], "Lahore", 500).status).toBe("pending");
  });
  it("builds tracking URLs from a courier template", () => {
    expect(buildTrackingUrl("https://track.example/?n={tracking}", " AB 12 ")).toBe("https://track.example/?n=AB%2012");
    expect(buildTrackingUrl("https://track.example/", "AB12")).toBeNull();
    expect(buildTrackingUrl("javascript:{tracking}", "x")).toBeNull();
  });
});

describe("link requests", () => {
  it("accepts public http(s) product links and shows only the domain", () => {
    expect(validateProductUrl("https://www.some-brand.pk/products/lawn-3pc?variant=1#reviews")).toEqual({ ok: true, url: "https://www.some-brand.pk/products/lawn-3pc?variant=1", domain: "some-brand.pk" });
    expect(validateProductUrl("brand.com.pk/p/1")).toMatchObject({ ok: true, domain: "brand.com.pk" });
  });
  it("rejects other schemes, internal hosts, IPs and credentials", () => {
    for (const bad of [
      "javascript:alert(1)",
      "ftp://brand.pk/x",
      "file:///etc/passwd",
      "http://localhost:3000/admin",
      "http://127.0.0.1/",
      "http://10.0.0.5/",
      "http://192.168.1.1/",
      "http://169.254.169.254/latest/meta-data",
      "http://[::1]/",
      "http://2130706433/",
      "http://intranet/",
      "http://shop.internal/x",
      "https://user:pass@brand.pk/",
      "https://brand.pk:8443/",
      "",
    ])
      expect(validateProductUrl(bad).ok, bad).toBe(false);
  });
  it("parses a multi-brand request into one box with per-row errors", () => {
    const r = parseRequestItems([
      { url: "https://brand-one.pk/p/1", productName: "Printed lawn 3-piece", brandName: "", size: "M", colour: "Blue", qty: 2, notes: "" },
      { url: "https://other.example.com/x", productName: "Kurta", brandName: "Other", size: "", colour: "", qty: 1, notes: "Eid gift" },
      { url: "http://localhost/x", productName: "Bad", brandName: "", size: "", colour: "", qty: 1, notes: "" },
      { url: "", productName: "", brandName: "", size: "", colour: "", qty: 1, notes: "" },
    ]);
    expect(r.items).toHaveLength(2);
    expect(r.items[0]).toMatchObject({ brandName: "Brand One", size: "M", qty: 2, domain: "brand-one.pk" });
    expect(r.errors["items.2.url"]).toBeTruthy();
    expect(brandFromDomain("pk.sapphire-online.com")).toBe("Sapphire Online");
  });
  it("is ready to quote only when every available item has a price and a weight", () => {
    expect(requestReadyToQuote([{ unavailable: false, unitPricePkr: null, weightG: 500 }]).ok).toBe(false);
    expect(requestReadyToQuote([{ unavailable: false, unitPricePkr: 300_000, weightG: null }]).ok).toBe(false);
    expect(requestReadyToQuote([{ unavailable: true, unitPricePkr: null, weightG: null }, { unavailable: false, unitPricePkr: 300_000, weightG: 600 }]).ok).toBe(true);
  });
  it("computes a request quote with the same margin and engine", () => {
    const q = computeBrandQuote(input({ items: [{ key: "a", title: "Kurta", unitPricePkr: 320_000, qty: 1, weightG: 500 }], city: "Karachi", domestic: { setting: { ...DEFAULT_DOMESTIC_DELIVERY, zones }, rates: [rate({})] } }));
    expect(q.lines.map((l) => [l.key, l.status, l.amount])).toEqual([
      ["items", "known", 320_000],
      ["shipping", "known", 25_000],
      ["duty", "not_applicable", null],
      ["service_fee", "known", 10_000],
    ]);
  });
});

describe("payment methods", () => {
  const s = DEFAULT_PAYMENT_METHODS;
  it("card uses Stripe when configured, else the labelled test mode in development", () => {
    expect(methodAvailability("card", s.card, "domestic", { STRIPE_SECRET_KEY: "sk_test_x" }, false)).toMatchObject({ available: true, status: "test", provider: "stripe" });
    expect(methodAvailability("card", s.card, "domestic", {}, true)).toMatchObject({ available: true, status: "test", provider: "test", note: "Test payment — no money moves" });
    expect(methodAvailability("card", s.card, "domestic", {}, false)).toMatchObject({ available: false, status: "awaiting_merchant_account" });
  });
  it("JazzCash and Easypaisa await a merchant account until credentials exist; sandbox is simulated", () => {
    expect(methodAvailability("jazzcash", s.jazzcash, "domestic", {}, true)).toMatchObject({ available: false, note: "Awaiting merchant account" });
    const env = { JAZZCASH_MERCHANT_ID: "MC1", JAZZCASH_PASSWORD: "p", JAZZCASH_INTEGRITY_SALT: "s" };
    expect(methodAvailability("jazzcash", s.jazzcash, "domestic", env, true)).toMatchObject({ available: true, status: "sandbox", provider: "jazzcash-sandbox" });
    expect(methodAvailability("jazzcash", { ...s.jazzcash, mode: "live" }, "domestic", env, true).available).toBe(false);
    expect(methodAvailability("easypaisa", { ...s.easypaisa, merchantId: "ST1" }, "domestic", { EASYPAISA_HASH_KEY: "k" }, true).status).toBe("sandbox");
  });
  it("respects per-market switches", () => {
    expect(availableMethods(s, "international", {}, true).map((m) => m.id)).toEqual(["card"]);
    expect(availableMethods(s, "domestic", {}, true).map((m) => m.id)).toEqual(["card", "jazzcash", "easypaisa"]);
  });
});
