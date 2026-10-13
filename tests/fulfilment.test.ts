import { describe, expect, it } from "vitest";
import {
  ageDays,
  chargeableWeightG,
  consolidationProgress,
  estimateConsolidatedBox,
  estimateHubDispatch,
  finalShippingDelta,
  isParcelLate,
  itemReadyDays,
  partialShipmentCheck,
  slowestItemDays,
  volumetricWeightG,
  type ParcelForConsolidation,
} from "@/lib/fulfilment/consolidation";
import { quoteDomesticParcels, zoneForParcel } from "@/lib/fulfilment/domestic-parcels";
import { checkChar, parcelReference, parseReference, shipmentReference } from "@/lib/fulfilment/reference";
import { CODE128_PATTERNS, code128Modules, code128Svg, code128Values } from "@/lib/fulfilment/barcode";
import { sandboxAdapter, sandboxTrackingNumber } from "@/lib/fulfilment/couriers/sandbox";
import { manualAdapter } from "@/lib/fulfilment/couriers/manual";
import { adapterChoices, getAdapter, requireAdapter } from "@/lib/fulfilment/couriers/registry";
import { COURIER_PROVIDERS, providerCredentialStatus } from "@/lib/fulfilment/couriers/providers";
import type { BookingRequest } from "@/lib/fulfilment/couriers/types";
import { routeOrder } from "@/lib/fulfilment/settings";
import { buildPlan, parcelsHeadline } from "@/lib/fulfilment/plan";
import { directParcelJourney, hubItemJourney } from "@/lib/fulfilment/journey";
import { renderLabelHtml } from "@/lib/fulfilment/label";
import { computeLandedCost, type LcItem } from "@/lib/commerce/landed-cost";
import type { DomesticDeliverySetting, DomesticRate } from "@/lib/brands/domestic";
import type { FxQuote } from "@/lib/money/currency";

const day = 86_400_000;
const now = new Date("2026-10-12T10:00:00Z");
const p = (id: string, status: ParcelForConsolidation["status"], itemCount = 1, expectedBy: Date | null = null): ParcelForConsolidation => ({ id, status, itemCount, expectedBy, senderLabel: id });

describe("consolidation: arrived counts", () => {
  it("counts items that have reached the hub, not parcels", () => {
    const prog = consolidationProgress([p("a", "qc_passed", 2), p("b", "received", 1), p("c", "in_transit", 1)]);
    expect(prog.totalItems).toBe(4);
    expect(prog.arrivedItems).toBe(3);
    expect(prog.readyItems).toBe(2);
    expect(prog.label).toBe("3 of 4 items arrived");
    expect(prog.readyToPack).toBe(false);
  });
  it("is ready to pack only when every live parcel has passed QC", () => {
    expect(consolidationProgress([p("a", "qc_passed"), p("b", "qc_passed")]).readyToPack).toBe(true);
    expect(consolidationProgress([p("a", "qc_passed"), p("b", "qc_failed")]).readyToPack).toBe(false);
    expect(consolidationProgress([p("a", "qc_passed"), p("b", "qc_failed")]).blocked).toBe(true);
  });
  it("ignores cancelled and returned parcels and reads '2 of 3 items arrived'", () => {
    const prog = consolidationProgress([p("a", "qc_passed"), p("b", "received"), p("c", "expected"), p("d", "cancelled", 5)]);
    expect(prog.label).toBe("2 of 3 items arrived");
    expect(prog.totalParcels).toBe(3);
  });
  it("is not ready to pack once everything has shipped", () => {
    expect(consolidationProgress([p("a", "shipped"), p("b", "shipped")]).readyToPack).toBe(false);
  });
});

describe("consolidation: slowest item estimate", () => {
  const ready = { availability: "ready_to_ship" as const, timeToMakeDays: null, dispatchDays: 3 };
  const made = { availability: "made_to_order" as const, timeToMakeDays: 21, dispatchDays: 2 };
  it("uses making time for made-to-order and dispatch time otherwise", () => {
    expect(itemReadyDays(ready)).toBe(3);
    expect(itemReadyDays(made)).toBe(21);
  });
  it("waits for the slowest item, then adds hub handling", () => {
    expect(slowestItemDays([ready, made])).toBe(21);
    const est = estimateHubDispatch(now, [ready, made], 2);
    expect(est.status).toBe("known");
    if (est.status === "known") expect(est.dispatchAt.getTime()).toBe(now.getTime() + 23 * day);
  });
  it("stays pending when a time is not stated or hub handling isn't set (never guessed)", () => {
    expect(estimateHubDispatch(now, [ready, { availability: "ready_to_ship", timeToMakeDays: null, dispatchDays: null }], 2).status).toBe("pending");
    const e = estimateHubDispatch(now, [ready], null);
    expect(e.status).toBe("pending");
    if (e.status === "pending") expect(e.reason).toMatch(/handling/);
  });
});

describe("consolidation: lateness and partial shipments", () => {
  const due = new Date(now.getTime() - 5 * day);
  it("a parcel is late only past the threshold and only before it arrives", () => {
    expect(isParcelLate(p("a", "expected", 1, due), now, 3)).toBe(true);
    expect(isParcelLate(p("a", "expected", 1, due), now, 7)).toBe(false);
    expect(isParcelLate(p("a", "received", 1, due), now, 3)).toBe(false);
    expect(isParcelLate(p("a", "expected", 1, null), now, 3)).toBe(false);
  });
  it("refuses a partial shipment while nobody is late", () => {
    const c = partialShipmentCheck([p("a", "qc_passed"), p("b", "in_transit", 1, new Date(now.getTime() + day))], now, 3);
    expect(c.allowed).toBe(false);
    if (!c.allowed) expect(c.reason).toMatch(/slowest item/);
  });
  it("refuses when nothing is ready, or when everything is (that's a full box)", () => {
    expect(partialShipmentCheck([p("a", "received"), p("b", "expected", 1, due)], now, 3).allowed).toBe(false);
    const all = partialShipmentCheck([p("a", "qc_passed"), p("b", "qc_passed")], now, 3);
    expect(all.allowed).toBe(false);
    if (!all.allowed) expect(all.reason).toMatch(/one box/);
  });
  it("allows shipping the ready items when a seller is late — extra shipping needs approval", () => {
    const c = partialShipmentCheck([p("a", "qc_passed", 2), p("b", "expected", 1, due)], now, 3);
    expect(c.allowed).toBe(true);
    if (c.allowed) {
      expect(c.ready.map((x) => x.id)).toEqual(["a"]);
      expect(c.late.map((x) => x.id)).toEqual(["b"]);
      expect(c.extraShippingNeedsApproval).toBe(true);
    }
  });
  it("ages from a date", () => {
    expect(ageDays(new Date(now.getTime() - 2.5 * day), now)).toBe(2);
    expect(ageDays(null, now)).toBeNull();
  });
});

describe("consolidation: volumetric and chargeable weight", () => {
  it("L×W×H/5000 in kg, rounded up to the gram", () => {
    expect(volumetricWeightG(50, 40, 30)).toBe(12_000);
    expect(volumetricWeightG(10, 10, 10)).toBe(200);
    expect(volumetricWeightG(10, 10, 10, 6000)).toBe(167);
    expect(volumetricWeightG(0, 10, 10)).toBe(0);
  });
  it("charges the greater of actual and volumetric", () => {
    expect(chargeableWeightG(8000, 12_000)).toBe(12_000);
    expect(chargeableWeightG(15_000, 12_000)).toBe(15_000);
  });
  it("estimates the combined box from listed weights and sizes", () => {
    const e = estimateConsolidatedBox([
      { weightG: 1000, qty: 2, widthCm: 30, heightCm: 20, depthCm: 10 },
      { weightG: 500, qty: 1, widthCm: 50, heightCm: 40, depthCm: 30 },
    ]);
    expect(e).toEqual({ status: "known", actualG: 2500, volumetricG: 14_400, chargeableG: 14_400 });
    expect(estimateConsolidatedBox([{ weightG: null, qty: 1 }]).status).toBe("pending");
  });
  it("asks the buyer only when the final box costs more", () => {
    expect(finalShippingDelta(5000, 6500)).toEqual({ action: "quote", difference: 1500 });
    expect(finalShippingDelta(5000, 4000).action).toBe("none");
    expect(finalShippingDelta(null, 4000).action).toBe("pending");
  });
});

const zones: DomesticDeliverySetting = {
  zones: [
    { key: "same_city", label: "Same city", cities: [] },
    { key: "major_cities", label: "Major cities", cities: ["Lahore", "Karachi", "Islamabad"] },
    { key: "other", label: "Rest of Pakistan", cities: [] },
  ],
  handlingDays: 2,
};
const rate = (zone: string, amount: number | null, extra: Partial<DomesticRate> = {}): DomesticRate => ({
  courier: "Demo Courier",
  serviceName: "Overnight",
  zone,
  minWeightG: 0,
  maxWeightG: 5000,
  amount,
  currency: "PKR",
  transitDaysMin: 1,
  transitDaysMax: 2,
  status: amount == null ? "pending" : "active",
  ...extra,
});

describe("domestic: one rate per parcel, summed", () => {
  it("uses the same-city zone when the seller is in the buyer's city", () => {
    expect(zoneForParcel(zones.zones, "Lahore", " lahore ")?.key).toBe("same_city");
    expect(zoneForParcel(zones.zones, "Multan", "Lahore")?.key).toBe("major_cities");
    expect(zoneForParcel(zones.zones, "Multan", "Sukkur")?.key).toBe("other");
  });
  it("sums every parcel's rate (same city cheaper)", () => {
    const q = quoteDomesticParcels(zones, [rate("same_city", 25_000), rate("major_cities", 40_000), rate("other", 60_000)], "Lahore", [
      { key: "a", label: "Lahore seller", originCity: "Lahore", weightG: 800 },
      { key: "b", label: "Multan seller", originCity: "Multan", weightG: 1200 },
    ]);
    expect(q.status).toBe("known");
    expect(q.totalPkr).toBe(65_000);
    expect(q.parcels.map((x) => x.status === "known" && x.amountPkr)).toEqual([25_000, 40_000]);
  });
  it("is pending — never zero, never a partial sum — when any parcel lacks a rate", () => {
    const q = quoteDomesticParcels(zones, [rate("same_city", 25_000), rate("major_cities", null)], "Lahore", [
      { key: "a", label: "Lahore seller", originCity: "Lahore", weightG: 800 },
      { key: "b", label: "Multan seller", originCity: "Multan", weightG: 1200 },
    ]);
    expect(q.status).toBe("pending");
    expect(q.totalPkr).toBeNull();
  });
  it("is pending without weights, without a city, or with an inactive courier", () => {
    expect(quoteDomesticParcels(zones, [rate("same_city", 25_000)], "Lahore", [{ key: "a", label: "x", originCity: "Lahore", weightG: null }]).totalPkr).toBeNull();
    expect(quoteDomesticParcels(zones, [rate("same_city", 25_000)], null, [{ key: "a", label: "x", originCity: "Lahore", weightG: 100 }]).reason).toMatch(/city/);
    expect(quoteDomesticParcels(zones, [rate("same_city", 25_000, { courierActive: false })], "Lahore", [{ key: "a", label: "x", originCity: "Lahore", weightG: 100 }]).status).toBe("pending");
  });
  it("feeds the landed-cost engine as pre-priced parcels: 'Delivery within Pakistan (2 parcels)'", () => {
    const fx: FxQuote = { currency: "PKR", pkrPerUnit: 1, source: "identity", status: "live" };
    const items: LcItem[] = ["a", "b"].map((v) => ({ productId: v, vendorId: v, categoryId: "c", title: v, unitPricePkr: 100_000, qty: 1, weightG: 500, availability: "ready_to_ship", timeToMakeDays: null, dispatchDays: 2 }));
    const base = { items, destination: "PK", fx, fxTable: {}, shippingRates: [], dutyRates: [], handling: { status: "pending" as const } };
    const known = computeLandedCost({ ...base, shipmentsOverride: [{ vendorId: "a", weightG: 500, status: "known", amount: 25_000 }, { vendorId: "b", weightG: 500, status: "known", amount: 40_000 }] });
    const ship = known.lines.find((l) => l.key === "shipping")!;
    expect(ship.amount).toBe(65_000);
    expect(ship.label).toBe("Delivery within Pakistan (2 parcels)");
    const pending = computeLandedCost({ ...base, shipmentsOverride: [{ vendorId: "a", weightG: 500, status: "known", amount: 25_000 }, { vendorId: "b", weightG: 500, status: "pending", reason: "no rate" }] });
    expect(pending.lines.find((l) => l.key === "shipping")).toMatchObject({ status: "pending", amount: null });
  });
  it("prices a consolidated box once, on its chargeable weight", () => {
    const fx: FxQuote = { currency: "USD", pkrPerUnit: 280, source: "test", status: "manual" };
    const items: LcItem[] = ["a", "b"].map((v) => ({ productId: v, vendorId: v, categoryId: "c", title: v, unitPricePkr: 280_000, qty: 1, weightG: 1000, availability: "ready_to_ship", timeToMakeDays: null, dispatchDays: 2 }));
    const rates = [
      { courier: "X", destinationCountry: "US", minWeightG: 0, maxWeightG: 2000, amount: 2_800_000, currency: "PKR", transitDaysMin: 3, transitDaysMax: 5, status: "active" as const },
      { courier: "X", destinationCountry: "US", minWeightG: 2001, maxWeightG: 20_000, amount: 5_600_000, currency: "PKR", transitDaysMin: 3, transitDaysMax: 5, status: "active" as const },
    ];
    const base = { items, destination: "US", fx, fxTable: {}, shippingRates: rates, dutyRates: [], handling: { status: "pending" as const } };
    expect(computeLandedCost(base).shipments).toHaveLength(2); // direct: one per artisan
    const hub = computeLandedCost({ ...base, consolidate: { weightG: 12_000 } });
    expect(hub.shipments).toHaveLength(1);
    expect(hub.shipments[0]).toMatchObject({ weightG: 12_000, amount: 20_000 });
    expect(computeLandedCost({ ...base, consolidate: { weightG: null, reason: "weight missing" } }).lines.find((l) => l.key === "shipping")?.status).toBe("pending");
  });
});

describe("label references", () => {
  it("derives readable references from the order number with a check character", () => {
    const ref = parcelReference("WB-4F7K2Q", 2);
    expect(ref).toMatch(/^WB-4F7K2Q-P2[2-9A-HJ-NP-Z]$/);
    expect(ref.endsWith(checkChar("WB-4F7K2Q-P2"))).toBe(true);
    expect(shipmentReference("WB-4F7K2Q", 1)).toMatch(/^WB-4F7K2Q-S1.$/);
    expect(parcelReference("WB-4F7K2Q", 1)).not.toBe(parcelReference("WB-4F7K2Q", 2));
  });
  it("parses typed or scanned codes and rejects typos", () => {
    const ref = parcelReference("WB-1005", 3);
    expect(parseReference(` ${ref.toLowerCase()} `)).toEqual({ reference: ref, orderNumber: "WB-1005", kind: "P", index: 3 });
    const wrong = ref.slice(0, -1) + (ref.endsWith("2") ? "3" : "2");
    expect(parseReference(wrong)).toBeNull();
    expect(parseReference(ref.replace("P3", "P4"))).toBeNull();
    expect(parseReference("hello")).toBeNull();
  });
  it("refuses out-of-range indexes", () => {
    expect(() => parcelReference("WB-1", 0)).toThrow();
    expect(() => parcelReference("WB-1", 100)).toThrow();
  });
});

describe("Code 128 barcode", () => {
  it("has a valid symbol table", () => {
    expect(CODE128_PATTERNS).toHaveLength(107);
    for (const pat of CODE128_PATTERNS.slice(0, 106)) expect([...pat].reduce((a, c) => a + Number(c), 0)).toBe(11);
    expect([...CODE128_PATTERNS[106]].reduce((a, c) => a + Number(c), 0)).toBe(13);
  });
  it("encodes with start B, the mod-103 checksum and stop", () => {
    // "PJJ123C": (104 + 48·1 + 42·2 + 42·3 + 17·4 + 18·5 + 19·6 + 35·7) mod 103 = 879 mod 103 = 55.
    const v = code128Values("PJJ123C");
    expect(v[0]).toBe(104);
    expect(v.at(-2)).toBe(55);
    expect(v.at(-1)).toBe(106);
    expect(code128Modules("A").reduce((a, b) => a + b, 0)).toBe(11 * 3 + 13);
    const svg = code128Svg("WB-1005-P1X");
    expect(svg).toContain("<svg");
    expect(svg).toContain("WB-1005-P1X");
    expect(() => code128Svg("ü")).toThrow();
  });
});

const req: BookingRequest = {
  reference: "WB-4F7K2Q-P1K",
  courierName: "Sandbox Courier",
  from: { name: "Seller", line1: "Workshop", city: "Multan", country: "PK" },
  to: { name: "Buyer", line1: "House 1", city: "Lahore", country: "PK" },
  weightG: 800,
};

describe("courier adapters", () => {
  it("sandbox books deterministically with an SBX tracking number and a generated label", async () => {
    expect(sandboxAdapter.available({ NODE_ENV: "test" })).toEqual({ ok: true });
    expect(sandboxAdapter.available({ NODE_ENV: "production" }).ok).toBe(false);
    expect(sandboxAdapter.available({ NODE_ENV: "production", ALLOW_SANDBOX_COURIERS: "true" }).ok).toBe(true);
    const a = await sandboxAdapter.bookShipment(req);
    const b = await sandboxAdapter.bookShipment(req);
    expect(a.trackingNumber).toBe(b.trackingNumber);
    expect(a.trackingNumber).toMatch(/^SBX\d{12}$/);
    expect(a.trackingNumber).toBe(sandboxTrackingNumber(req.reference));
    expect(a.provider).toBe("sandbox");
    const label = await sandboxAdapter.getLabel(req, a);
    expect(label.kind).toBe("generated");
    if (label.kind === "generated") {
      expect(label.reference).toBe(req.reference);
      expect(label.note).toMatch(/SANDBOX/);
    }
    const t = await sandboxAdapter.track(a.trackingNumber, {});
    expect(t.status).toBe("booked");
    await expect(sandboxAdapter.bookShipment({ ...req, to: { ...req.to, city: "" } })).rejects.toThrow(/cities/);
  });
  it("manual needs a typed tracking number and builds the link from the courier template", async () => {
    await expect(manualAdapter.bookShipment(req)).rejects.toThrow(/tracking number/);
    const r = await manualAdapter.bookShipment({ ...req, trackingNumber: "TCS778812345", trackingUrlTemplate: "https://courier.example/track?n={tracking}" });
    expect(r).toMatchObject({ provider: "manual", trackingNumber: "TCS778812345", trackingUrl: "https://courier.example/track?n=TCS778812345" });
    await expect(manualAdapter.bookShipment({ ...req, trackingNumber: "bad number!" })).rejects.toThrow();
    expect((await manualAdapter.track("X1", { trackingUrlTemplate: null })).status).toBe("unknown");
  });
  it("real providers are extension points: listed with env var names, never callable yet", () => {
    expect(COURIER_PROVIDERS.map((p) => p.id)).toEqual(expect.arrayContaining(["tcs", "leopards", "mnp", "postex", "trax", "dhl", "fedex", "aramex"]));
    expect(() => requireAdapter("tcs", {})).toThrow(/isn't built yet/);
    expect(getAdapter("tcs").id).toBe("manual");
    expect(adapterChoices().find((c) => c.id === "dhl")?.implemented).toBe(false);
    const st = providerCredentialStatus(COURIER_PROVIDERS.find((p) => p.id === "postex")!, { POSTEX_API_TOKEN: "secret" });
    expect(st).toEqual({ vars: [{ name: "POSTEX_API_TOKEN", set: true }], allSet: true, anySet: true });
  });
});

describe("routing, plan and journey", () => {
  it("domestic ships direct; international consolidates only at an active hub", () => {
    expect(routeOrder({ destination: "PK", setting: { consolidateInternational: true }, activeOriginHubId: "h" })).toEqual({ mode: "direct", hubId: null });
    expect(routeOrder({ destination: "US", setting: { consolidateInternational: true }, activeOriginHubId: "h" })).toEqual({ mode: "hub", hubId: "h" });
    expect(routeOrder({ destination: "US", setting: { consolidateInternational: true }, activeOriginHubId: null }).mode).toBe("direct");
    expect(routeOrder({ destination: "GB", setting: { consolidateInternational: false }, activeOriginHubId: "h" }).mode).toBe("direct");
  });
  it("tells the buyer how many parcels, from where, or the hub dispatch date", () => {
    const items = [
      { sellerKey: "a", sellerName: "A", sellerCity: "Lahore", qty: 2, availability: "ready_to_ship" as const, timeToMakeDays: null, dispatchDays: 2 },
      { sellerKey: "b", sellerName: "B", sellerCity: "Multan", qty: 1, availability: "made_to_order" as const, timeToMakeDays: 10, dispatchDays: null },
    ];
    const direct = buildPlan({ mode: "direct", destination: "PK", items, start: now });
    expect(direct.mode === "direct" && direct.parcels.map((p) => [p.sellerCity, p.itemCount, p.readyDays])).toEqual([
      ["Lahore", 2, 2],
      ["Multan", 1, 10],
    ]);
    expect(parcelsHeadline(2)).toBe("Arrives in 2 parcels");
    expect(parcelsHeadline(1)).toBe("Arrives in 1 parcel");
    const hub = buildPlan({ mode: "hub", destination: "US", items, hub: { city: "Lahore", handlingDays: 2 }, start: now });
    expect(hub.mode === "hub" && hub.dispatch.status === "known" && hub.dispatch.dispatchAt.getTime()).toBe(now.getTime() + 12 * day);
  });
  it("maps parcel + shipment status to the buyer's per-item journey", () => {
    expect(hubItemJourney("expected", null).step).toBe(0);
    expect(hubItemJourney("in_transit", null).label).toBe("On the way to our hub");
    expect(hubItemJourney("qc_passed", null)).toMatchObject({ step: 2, detail: "Checked" });
    expect(hubItemJourney("shipped", "shipped").step).toBe(4);
    expect(hubItemJourney("shipped", "delivered").step).toBe(5);
    expect(directParcelJourney("ready_to_ship", "booked").label).toBe("Courier booked");
    expect(directParcelJourney("shipped", "shipped").step).toBe(2);
  });
  it("renders a printable label with the reference barcode", () => {
    const html = renderLabelHtml({ title: "Send to hub", reference: "WB-1-P1X", orderNumber: "WB-1", courierName: "Sandbox", trackingNumber: "SBX1", from: req.from, to: req.to, weightG: 800, itemCount: 1, note: "SANDBOX LABEL" });
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("WB-1-P1X");
    expect(html).toContain("SANDBOX LABEL");
    expect(html).toContain("Barcode SBX1");
    expect(renderLabelHtml({ title: "<x>", reference: "R", orderNumber: "O", courierName: null, trackingNumber: null, from: req.from, to: req.to, weightG: null, itemCount: 1 })).not.toContain("<x>");
  });
});
