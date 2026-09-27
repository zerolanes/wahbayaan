import { describe, expect, it } from "vitest";
import { computeLandedCost, type LcDutyRate, type LcInput, type LcItem, type LcShippingRate } from "@/lib/commerce/landed-cost";
import type { FxQuote } from "@/lib/money/currency";

// Test-only numbers. They are deliberately round so the arithmetic is easy to
// follow and are not meant to resemble real exchange, courier or duty rates.
const USD: FxQuote = { currency: "USD", pkrPerUnit: 100, source: "test", status: "manual" };
const GBP: FxQuote = { currency: "GBP", pkrPerUnit: 200, source: "test", status: "manual" };

const rug: LcItem = {
  productId: "p1",
  vendorId: "v1",
  categoryId: "rugs",
  title: "Rug",
  unitPricePkr: 100_000_00, // Rs 100,000 → $1,000 at the test rate
  qty: 1,
  weightG: 5000,
  availability: "ready_to_ship",
  timeToMakeDays: null,
  dispatchDays: 3,
};

const activeRate: LcShippingRate = {
  courier: "Courier A",
  destinationCountry: "US",
  minWeightG: 0,
  maxWeightG: 10_000,
  amount: 10_000_00, // Rs 10,000 → $100
  currency: "PKR",
  transitDaysMin: 5,
  transitDaysMax: 8,
  status: "active",
};

const dutyUS: LcDutyRate = {
  destinationCountry: "US",
  categoryId: "rugs",
  hsCode: null,
  dutyPercent: 10,
  taxPercent: null,
  taxLabel: null,
  deMinimisAmount: null,
  deMinimisCurrency: null,
  basis: "item",
  status: "active",
};

function base(overrides: Partial<LcInput> = {}): LcInput {
  return {
    items: [rug],
    destination: "US",
    fx: USD,
    fxTable: { USD, GBP },
    shippingRates: [],
    dutyRates: [],
    handling: { status: "pending" },
    ...overrides,
  };
}

const line = (r: ReturnType<typeof computeLandedCost>, key: string) => r.lines.find((l) => l.key === key)!;

describe("computeLandedCost", () => {
  it("never prices unknown shipping, duty or handling as zero", () => {
    const r = computeLandedCost(base());
    expect(line(r, "items")).toMatchObject({ status: "known", amount: 1000_00 });
    for (const key of ["shipping", "duty", "import_tax", "handling"]) {
      expect(line(r, key).status).toBe("pending");
      expect(line(r, key).amount).toBeNull();
      expect(line(r, key).note).toMatch(/Pending real rate data/);
    }
    expect(r.complete).toBe(false);
    expect(r.knownTotal).toBe(1000_00);
  });

  it("prices every line once real rates exist", () => {
    const r = computeLandedCost(
      base({
        shippingRates: [activeRate],
        dutyRates: [dutyUS],
        handling: { status: "active", kind: "percent", percentBps: 500 },
      }),
    );
    expect(line(r, "shipping")).toMatchObject({ status: "known", amount: 100_00 });
    expect(line(r, "duty")).toMatchObject({ status: "known", amount: 100_00 });
    expect(line(r, "import_tax").status).toBe("not_applicable");
    expect(line(r, "handling")).toMatchObject({ status: "known", amount: 50_00 });
    expect(r.complete).toBe(true);
    expect(r.knownTotal).toBe(1000_00 + 100_00 + 100_00 + 50_00);
    expect(r.delivery).toEqual({ productionDaysMax: 3, transitDaysMin: 5, transitDaysMax: 8, status: "known" });
  });

  it("keeps shipping pending when an item has no weight", () => {
    const r = computeLandedCost(base({ items: [{ ...rug, weightG: null }], shippingRates: [activeRate] }));
    expect(line(r, "shipping").status).toBe("pending");
    expect(line(r, "shipping").note).toMatch(/weight not listed/i);
  });

  it("ignores rates that are still pending, even when an amount was typed in", () => {
    const r = computeLandedCost(base({ shippingRates: [{ ...activeRate, status: "pending" }] }));
    expect(line(r, "shipping").status).toBe("pending");
  });

  it("quotes one parcel per artisan and picks the cheapest confirmed rate", () => {
    const second: LcItem = { ...rug, productId: "p2", vendorId: "v2", weightG: 1000 };
    const cheaper: LcShippingRate = { ...activeRate, courier: "Courier B", amount: 8_000_00 };
    const r = computeLandedCost(base({ items: [rug, second], shippingRates: [activeRate, cheaper] }));
    expect(r.shipments).toHaveLength(2);
    expect(r.shipments.every((s) => s.courier === "Courier B")).toBe(true);
    expect(line(r, "shipping").amount).toBe(160_00);
  });

  it("charges duty on item + shipping when the basis says so, and tax on top of duty", () => {
    const r = computeLandedCost(
      base({
        shippingRates: [activeRate],
        dutyRates: [{ ...dutyUS, basis: "item_plus_shipping", taxPercent: 20, taxLabel: "VAT" }],
      }),
    );
    // duty = 10% of (1000 + 100) = 110; VAT = 20% of (1000 + 100 + 110) = 242
    expect(line(r, "duty").amount).toBe(110_00);
    expect(line(r, "import_tax")).toMatchObject({ label: "VAT", amount: 242_00, status: "known" });
  });

  it("keeps duty pending when it depends on shipping that is still pending", () => {
    const r = computeLandedCost(base({ dutyRates: [{ ...dutyUS, basis: "item_plus_shipping" }] }));
    expect(line(r, "duty").status).toBe("pending");
    expect(line(r, "duty").note).toMatch(/shipping/);
  });

  it("applies a de minimis threshold quoted in another currency", () => {
    const threshold = { ...dutyUS, deMinimisAmount: 800_00, deMinimisCurrency: "GBP" }; // £800 = $1,600 at test rates
    const r = computeLandedCost(base({ dutyRates: [threshold] }));
    expect(line(r, "duty")).toMatchObject({ status: "known", amount: 0 });
    expect(line(r, "duty").note).toMatch(/threshold/);
  });

  it("converts prices into the buyer's currency", () => {
    const r = computeLandedCost(base({ fx: GBP, destination: "GB" }));
    expect(line(r, "items").amount).toBe(500_00);
    expect(r.currency).toBe("GBP");
  });

  it("adds gift wrap and subtracts discounts", () => {
    const r = computeLandedCost(
      base({
        giftWrap: { selected: true, setting: { status: "active", amount: 1_000_00, currency: "PKR" } },
        discount: { amount: 50_00, label: "Coupon WELCOME" },
      }),
    );
    expect(line(r, "gift_wrap")).toMatchObject({ status: "known", amount: 10_00 });
    expect(line(r, "discount")).toMatchObject({ amount: -50_00 });
  });

  it("marks production time unknown when a made-to-order piece has no time-to-make", () => {
    const r = computeLandedCost(base({ items: [{ ...rug, availability: "made_to_order", timeToMakeDays: null }] }));
    expect(r.delivery.productionDaysMax).toBeNull();
    expect(r.delivery.status).toBe("pending");
  });
});
