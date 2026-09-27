import { describe, expect, it } from "vitest";
import { activeChips, clearFiltersHref, pageCount, parseShopQuery, priceBands, shopHref, toProductFilters } from "@/lib/shop-params";
import { COMPARE_MAX, parseCompareCookie, serializeCompare, toggleCompareId, valuesDiffer } from "@/lib/compare";
import { countdownParts, isUpcomingDrop } from "@/lib/countdown";
import { bundleSavingFor, computeBundleSavings } from "@/lib/commerce/bundles";
import { buyerOrderActions, disputeStep, joinCostLabels, orderCostLines, orderJourneyStep } from "@/lib/commerce/order-view";
import type { FxQuote } from "@/lib/money/currency";

const USD: FxQuote = { currency: "USD", pkrPerUnit: 100, source: "test", status: "manual" };
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("shop search params", () => {
  it("parses and validates params, falling back to safe defaults", () => {
    const q = parseShopQuery({ sort: "price_asc", page: "3", region: "punjab", availability: "made_to_order", customizable: "1", price: "500-1000" });
    expect(q).toMatchObject({ sort: "price_asc", page: 3, region: "punjab", availability: "made_to_order", customizable: true, price: "500-1000" });
    const bad = parseShopQuery({ sort: "drop table", page: "-2", region: "atlantis", availability: "soon", price: "free" });
    expect(bad).toMatchObject({ sort: "featured", page: 1, region: undefined, availability: undefined, price: undefined });
  });

  it("builds links that drop defaults and reset the page when a filter changes", () => {
    const q = parseShopQuery({ sort: "newest", page: "2", material: "wool" });
    expect(shopHref("/shop", q, { page: 3 })).toBe("/shop?material=wool&sort=newest&page=3");
    expect(shopHref("/shop", q, { region: "sindh" })).toBe("/shop?region=sindh&material=wool&sort=newest");
    expect(shopHref("/shop", q, { material: undefined, sort: "featured" })).toBe("/shop");
    expect(clearFiltersHref("/category/rugs", q)).toBe("/category/rugs?sort=newest");
  });

  it("lists removable chips for active filters only", () => {
    const q = parseShopQuery({ category: "rugs", price: "under-250", sort: "rating" });
    const chips = activeChips("/shop", q, { currency: "USD", categories: [{ slug: "rugs", name: "Handmade Carpets & Rugs" }] });
    expect(chips.map((c) => c.label)).toEqual(["Handmade Carpets & Rugs", "Under $250"]);
    expect(chips[0].href).toBe("/shop?price=under-250&sort=rating");
  });

  it("converts price bands in the buyer's currency into minor-unit filters", () => {
    const f = toProductFilters(parseShopQuery({ price: "500-1000", page: "2" }), { currency: "USD", fx: USD });
    expect(f).toMatchObject({ minPrice: 500_00, maxPrice: 1000_00, offset: 24, limit: 24, fx: USD });
    expect(priceBands("PKR")[0].label).toBe("Under Rs 75,000");
    expect(pageCount(0)).toBe(1);
    expect(pageCount(49)).toBe(3);
  });
});

describe("compare list", () => {
  it("parses only valid, unique ids and caps the list", () => {
    const raw = [id(1), "nope", id(1), id(2), id(3), id(4), id(5)].join(",");
    expect(parseCompareCookie(raw)).toEqual([id(1), id(2), id(3), id(4)]);
    expect(parseCompareCookie(undefined)).toEqual([]);
    expect(serializeCompare([id(1), id(2)])).toBe(`${id(1)},${id(2)}`);
  });

  it("toggles ids and refuses to grow past the maximum", () => {
    let ids: string[] = [];
    for (let i = 1; i <= COMPARE_MAX; i++) ids = toggleCompareId(ids, id(i)).ids;
    const full = toggleCompareId(ids, id(9));
    expect(full.full).toBe(true);
    expect(full.ids).toHaveLength(COMPARE_MAX);
    const removed = toggleCompareId(ids, id(2));
    expect(removed.removed).toBe(true);
    expect(removed.ids).not.toContain(id(2));
  });

  it("detects rows that differ", () => {
    expect(valuesDiffer(["Wool", " wool "])).toBe(false);
    expect(valuesDiffer(["Wool", "Silk"])).toBe(true);
    expect(valuesDiffer([null, ""])).toBe(false);
    expect(valuesDiffer(["x"])).toBe(false);
  });
});

describe("countdown", () => {
  it("splits the remaining time and never goes negative", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    expect(countdownParts("2026-01-02T01:02:03Z", now)).toEqual({ done: false, days: 1, hours: 1, minutes: 2, seconds: 3 });
    expect(countdownParts("2025-12-31T00:00:00Z", now)).toMatchObject({ done: true, days: 0, seconds: 0 });
    expect(isUpcomingDrop({ isLimitedDrop: true, dropStartsAt: "2026-02-01T00:00:00Z" }, now)).toBe(true);
    expect(isUpcomingDrop({ isLimitedDrop: false, dropStartsAt: "2026-02-01T00:00:00Z" }, now)).toBe(false);
  });
});

describe("bundle savings", () => {
  const bundle = { slug: "nook", title: "Reading nook", bundleDiscountBps: 1000, productIds: ["a", "b", "c"] };
  it("applies only when every piece is in the cart", () => {
    expect(computeBundleSavings([bundle], [{ productId: "a", unitPrice: 100_00, qty: 1 }, { productId: "b", unitPrice: 200_00, qty: 1 }])).toBeNull();
    const s = computeBundleSavings(
      [bundle],
      [
        { productId: "a", unitPrice: 100_00, qty: 1 },
        { productId: "b", unitPrice: 200_00, qty: 2 },
        { productId: "c", unitPrice: 300_00, qty: 1 },
      ],
    );
    expect(s?.amount).toBe(60_00); // 10% of one of each piece (600.00)
    expect(s?.label).toBe("Bundle saving — Reading nook");
  });

  it("ignores bundles without a discount", () => {
    expect(computeBundleSavings([{ ...bundle, bundleDiscountBps: null }], [{ productId: "a", unitPrice: 1, qty: 1 }])).toBeNull();
    expect(bundleSavingFor([100_00, 50_00], 0)).toBe(0);
  });
});

describe("buyer order view", () => {
  const base = {
    itemsSubtotal: 500_00,
    shippingAmount: null,
    shippingStatus: "pending" as const,
    dutyAmount: null,
    dutyStatus: "pending" as const,
    importTaxAmount: null,
    importTaxStatus: "pending" as const,
    handlingAmount: null,
    handlingStatus: "not_applicable" as const,
    giftWrap: false,
    giftWrapAmount: null,
    discountAmount: 0,
    total: 500_00,
    totalComplete: false,
  };

  it("keeps unconfirmed lines pending — never zero", () => {
    const v = orderCostLines(base);
    expect(v.complete).toBe(false);
    expect(v.pendingCount).toBe(3);
    expect(v.lines.find((l) => l.key === "shipping")).toMatchObject({ status: "pending", amount: null });
    expect(v.lines.find((l) => l.key === "handling")).toMatchObject({ status: "not_applicable", amount: null });
  });

  it("shows a quoted order as complete", () => {
    const v = orderCostLines({ ...base, shippingAmount: 80_00, shippingStatus: "known", dutyAmount: 0, dutyStatus: "known", importTaxStatus: "not_applicable", total: 580_00, totalComplete: true });
    expect(v.complete).toBe(true);
    expect(v.lines.find((l) => l.key === "duty")).toMatchObject({ status: "known", amount: 0 });
  });

  it("maps statuses to the journey and allowed actions", () => {
    expect(orderJourneyStep("awaiting_quote")).toBe(0);
    expect(orderJourneyStep("shipped")).toBe(3);
    expect(orderJourneyStep("cancelled")).toBe(-1);
    const quote = buyerOrderActions({ status: "quote_sent", paymentStatus: "unpaid", totalComplete: true, vendorStatuses: ["pending"], hasOpenDispute: false });
    expect(quote).toMatchObject({ canPay: true, canConfirmDelivery: false, canOpenCase: false, canCancel: true });
    const shipped = buyerOrderActions({ status: "shipped", paymentStatus: "paid", totalComplete: true, vendorStatuses: ["shipped"], hasOpenDispute: false });
    expect(shipped).toMatchObject({ canPay: false, canConfirmDelivery: true, canOpenCase: true, canCancel: false });
    expect(buyerOrderActions({ ...{ status: "delivered", paymentStatus: "paid", totalComplete: true, vendorStatuses: ["delivered"] }, hasOpenDispute: true }).canOpenCase).toBe(false);
    expect(disputeStep("under_review")).toBe(2);
  });

  it("joins pending cost labels into a sentence, keeping the brand capitalised", () => {
    expect(joinCostLabels(["International shipping", "Import duty", "Wahbayaan handling"])).toBe("international shipping, import duty and Wahbayaan handling");
    expect(joinCostLabels(["Import duty"])).toBe("import duty");
  });
});
