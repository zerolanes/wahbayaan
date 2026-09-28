import { describe, expect, it } from "vitest";
import { postState, RESERVED_PAGE_SLUGS, windowState } from "@/lib/admin/content";
import { couponState, describeCoupon, normalizeCouponCode, usageShare, validateCoupon, type CouponInput } from "@/lib/admin/coupons";
import { detectContactDetails, hasContactDetails, redactContactDetails, REDACTION, segmentContactDetails } from "@/lib/admin/moderation";
import { byDestination, fromPkr, gmvByMonth, landedCostAverages, lifetimeValue, monthKeys, refundDisputeRates, toPkr, type ReportOrder } from "@/lib/admin/reports";
import { requestSla, ticketSla } from "@/lib/admin/sla";

const base: CouponInput = { code: "welcome10", kind: "percent", percentBps: 1000, amount: null, currency: null, minSubtotal: null, startsAt: null, endsAt: null, maxUses: null };

describe("coupon validation", () => {
  it("normalises codes the way the cart reads them", () => {
    expect(normalizeCouponCode("  eid sale ")).toBe("EID-SALE");
  });
  it("accepts a plain percentage coupon", () => {
    expect(validateCoupon(base)).toBeNull();
  });
  it("rejects bad codes and out-of-range percentages", () => {
    expect(validateCoupon({ ...base, code: "a" })).toMatch(/3–40/);
    expect(validateCoupon({ ...base, code: "hi!there" })).toMatch(/letters/);
    expect(validateCoupon({ ...base, percentBps: null })).toMatch(/percentage/);
    expect(validateCoupon({ ...base, percentBps: 9_500 })).toMatch(/90%/);
  });
  it("requires an amount and buyer currency for fixed coupons", () => {
    const fixed = { ...base, kind: "fixed" as const, percentBps: null };
    expect(validateCoupon(fixed)).toMatch(/amount/);
    expect(validateCoupon({ ...fixed, amount: 25_00 })).toMatch(/currency/);
    expect(validateCoupon({ ...fixed, amount: 25_00, currency: "EUR" })).toMatch(/currency/);
    expect(validateCoupon({ ...fixed, amount: 25_00, currency: "USD" })).toBeNull();
    expect(validateCoupon({ ...fixed, amount: 250_00, currency: "USD", minSubtotal: 200_00 })).toMatch(/less than the minimum/);
  });
  it("checks the date window and usage limit", () => {
    expect(validateCoupon({ ...base, startsAt: new Date("2026-02-01"), endsAt: new Date("2026-01-01") })).toMatch(/after the start/);
    expect(validateCoupon({ ...base, maxUses: 0 })).toMatch(/at least 1/);
    expect(validateCoupon({ ...base, minSubtotal: 100_00 })).toMatch(/needs a currency/);
  });
  it("derives state from the switch, dates and usage", () => {
    const now = new Date("2026-06-10T00:00:00Z");
    const c = { isActive: true, startsAt: null, endsAt: null, maxUses: null, usedCount: 0 };
    expect(couponState(c, now)).toBe("active");
    expect(couponState({ ...c, isActive: false }, now)).toBe("disabled");
    expect(couponState({ ...c, startsAt: new Date("2026-07-01") }, now)).toBe("scheduled");
    expect(couponState({ ...c, endsAt: new Date("2026-06-01") }, now)).toBe("expired");
    expect(couponState({ ...c, maxUses: 5, usedCount: 5 }, now)).toBe("exhausted");
    expect(usageShare({ maxUses: 4, usedCount: 1 })).toBe(0.25);
    expect(usageShare({ maxUses: null, usedCount: 9 })).toBeNull();
  });
  it("describes the discount with its currency", () => {
    expect(describeCoupon({ kind: "percent", percentBps: 1250, amount: null, currency: null, minSubtotal: null })).toBe("12.5% off");
    expect(describeCoupon({ kind: "fixed", percentBps: null, amount: 25_00, currency: "USD", minSubtotal: 200_00 })).toBe("$25 USD off · orders over $200 USD");
  });
});

describe("contact-detail moderation", () => {
  it("finds emails, phone numbers, links and messaging apps", () => {
    const hits = detectContactDetails("WhatsApp me on +92 300 1234567 or karim.salt@gmail.com, see www.karimsalt.pk");
    expect(hits.map((h) => h.kind)).toEqual(["app", "phone", "email", "link"]);
    expect(hits[1].match).toBe("+92 300 1234567");
  });
  it("catches obfuscated emails and handles", () => {
    expect(detectContactDetails("write to ali [at] mail [dot] com").map((h) => h.kind)).toEqual(["email"]);
    expect(detectContactDetails("follow @noor.calligraphy").map((h) => h.kind)).toEqual(["handle"]);
  });
  it("ignores normal craft talk, sizes and prices", () => {
    expect(hasContactDetails("Is the red closer to brick or wine? 6x9 ft, about 180 × 270 cm, Rs 45,000.")).toBe(false);
    expect(hasContactDetails("Order WB-1004 shipped on 12/03/2026")).toBe(false);
  });
  it("segments and redacts matches", () => {
    const segs = segmentContactDetails("call 0300-1234567 today");
    expect(segs).toEqual([{ text: "call " }, { text: "0300-1234567", hit: "phone" }, { text: " today" }]);
    expect(redactContactDetails("mail me: a@b.co please")).toBe(`mail me: ${REDACTION} please`);
  });
});

const order = (o: Partial<ReportOrder>): ReportOrder => ({
  createdAt: new Date("2026-05-10"),
  paidAt: new Date("2026-05-10"),
  status: "paid",
  currency: "USD",
  fx: 280,
  destination: "US",
  itemsSubtotal: 100_00,
  total: 120_00,
  discountAmount: 0,
  shippingAmount: 20_00,
  shippingStatus: "known",
  dutyAmount: null,
  dutyStatus: "pending",
  importTaxAmount: null,
  importTaxStatus: "not_applicable",
  handlingAmount: null,
  handlingStatus: "pending",
  ...o,
});

describe("report aggregation", () => {
  it("lists every month in the range", () => {
    expect(monthKeys(new Date("2025-11-15"), new Date("2026-02-01"))).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
  it("converts at the order's recorded rate", () => {
    expect(toPkr(120_00, 280)).toBe(3_360_000);
    expect(fromPkr(3_360_000, 280)).toBe(120_00);
    expect(fromPkr(100, 0)).toBeNull();
  });
  it("buckets paid GMV by payment month, per currency and in PKR", () => {
    const rows = gmvByMonth(
      [order({}), order({ currency: "GBP", fx: 375, total: 80_00, paidAt: new Date("2026-05-20") }), order({ paidAt: new Date("2026-06-02") }), order({ paidAt: null })],
      new Date("2026-05-01"),
      new Date("2026-06-30"),
    );
    expect(rows.map((r) => r.key)).toEqual(["2026-05", "2026-06"]);
    expect(rows[0].orders).toBe(2);
    expect(rows[0].byCurrency).toEqual({ USD: 120_00, GBP: 80_00 });
    expect(rows[0].pkr).toBe(120_00 * 280 + 80_00 * 375);
    expect(rows[1].orders).toBe(1);
  });
  it("groups by destination with paid totals only", () => {
    const rows = byDestination([order({}), order({ destination: "GB", currency: "GBP", fx: 375, total: 50_00 }), order({ paidAt: null })]);
    expect(rows[0]).toMatchObject({ country: "US", orders: 2, paid: 1 });
    expect(rows[1].country).toBe("GB");
  });
  it("averages only known landed-cost lines and counts pending ones", () => {
    const [usd] = landedCostAverages([order({}), order({ shippingAmount: 40_00, itemsSubtotal: 200_00 }), order({ shippingAmount: null, shippingStatus: "pending" })]);
    const ship = usd.components.find((c) => c.key === "shipping")!;
    expect(ship).toMatchObject({ known: 2, pending: 1, average: 30_00 });
    expect(ship.shareOfItems).toBeCloseTo(0.2);
    const duty = usd.components.find((c) => c.key === "duty")!;
    expect(duty.average).toBeNull();
    expect(duty.pending).toBe(3);
    expect(usd.components.find((c) => c.key === "importTax")!.notApplicable).toBe(3);
  });
  it("computes refund and dispute rates over paid orders", () => {
    expect(refundDisputeRates({ paidOrders: 20, refundedOrders: 1, disputedOrders: 2 })).toEqual({ refundRate: 0.05, disputeRate: 0.1 });
    expect(refundDisputeRates({ paidOrders: 0, refundedOrders: 0, disputedOrders: 0 }).refundRate).toBeNull();
  });
  it("computes lifetime value per currency and in PKR, net of refunds", () => {
    const ltv = lifetimeValue(
      [
        { currency: "USD", total: 100_00, fx: 280, paidAt: new Date(), status: "completed" },
        { currency: "USD", total: 50_00, fx: 300, paidAt: new Date(), status: "paid" },
        { currency: "GBP", total: 10_00, fx: 375, paidAt: new Date(), status: "delivered" },
        { currency: "USD", total: 999_00, fx: 280, paidAt: null, status: "awaiting_payment" },
        { currency: "USD", total: 70_00, fx: 280, paidAt: new Date(), status: "refunded" },
      ],
      { GBP: 5_00 },
    );
    expect(ltv.paidOrders).toBe(3);
    expect(ltv.primaryCurrency).toBe("USD");
    expect(ltv.byCurrency.find((r) => r.currency === "USD")).toMatchObject({ total: 150_00, pkr: 100_00 * 280 + 50_00 * 300, orders: 2 });
    expect(ltv.byCurrency.find((r) => r.currency === "GBP")).toMatchObject({ total: 5_00, pkr: 5_00 * 375 });
  });
});

describe("request and inbox SLAs", () => {
  const now = new Date("2026-06-10T12:00:00Z");
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);
  it("flags unmatched requests after a day and unquoted after three", () => {
    expect(requestSla({ status: "new", createdAt: hoursAgo(5), matched: false }, now).tone).toBe("gold");
    expect(requestSla({ status: "new", createdAt: hoursAgo(30), matched: false }, now).note).toBe("Not matched to an artisan");
    expect(requestSla({ status: "new", createdAt: hoursAgo(50), matched: true }, now).tone).toBe("warning");
    expect(requestSla({ status: "new", createdAt: hoursAgo(80), matched: true }, now).breached).toBe(true);
  });
  it("ages quotes from when they were sent", () => {
    const s = requestSla({ status: "quoted", createdAt: hoursAgo(500), quotedAt: hoursAgo(24), matched: true }, now);
    expect(s.tone).toBe("gold");
    expect(s.stageLabel).toBe("24h");
    expect(requestSla({ status: "quoted", createdAt: hoursAgo(500), quotedAt: hoursAgo(400), matched: true }, now).tone).toBe("warning");
    expect(requestSla({ status: "declined", createdAt: hoursAgo(500), matched: true }, now).tone).toBe("neutral");
  });
  it("tracks first replies to support messages", () => {
    expect(ticketSla({ status: "new", createdAt: hoursAgo(2) }, now).tone).toBe("gold");
    expect(ticketSla({ status: "new", createdAt: hoursAgo(13) }, now).tone).toBe("warning");
    expect(ticketSla({ status: "new", createdAt: hoursAgo(30) }, now).breached).toBe(true);
    expect(ticketSla({ status: "resolved", createdAt: hoursAgo(300) }, now).tone).toBe("success");
  });
});

describe("content scheduling", () => {
  const now = new Date("2026-06-10T12:00:00Z");
  it("derives banner state from the switch and window", () => {
    expect(windowState({ isActive: false, startsAt: null, endsAt: null }, now)).toBe("off");
    expect(windowState({ isActive: true, startsAt: null, endsAt: null }, now)).toBe("live");
    expect(windowState({ isActive: true, startsAt: new Date("2026-06-11"), endsAt: null }, now)).toBe("scheduled");
    expect(windowState({ isActive: true, startsAt: null, endsAt: new Date("2026-06-10T11:00:00Z") }, now)).toBe("ended");
  });
  it("treats a future publish date as scheduled", () => {
    expect(postState({ status: "draft", publishedAt: null }, now)).toBe("draft");
    expect(postState({ status: "published", publishedAt: null }, now)).toBe("published");
    expect(postState({ status: "published", publishedAt: new Date("2026-06-01") }, now)).toBe("published");
    expect(postState({ status: "published", publishedAt: new Date("2026-07-01") }, now)).toBe("scheduled");
  });
  it("keeps CMS pages off real app routes", () => {
    for (const s of ["shop", "journal", "admin", "product", "seller"]) expect(RESERVED_PAGE_SLUGS).toContain(s);
    expect(RESERVED_PAGE_SLUGS).not.toContain("terms");
  });
});
