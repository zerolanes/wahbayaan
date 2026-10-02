import { describe, expect, it } from "vitest";
import { BUYER_DESTINATIONS, DESTINATIONS, convert, convertFromPkr, defaultCurrencyFor, destinationName, formatMoney, isBuyerDestination, isDestination, type FxQuote } from "@/lib/money/currency";

const USD: FxQuote = { currency: "USD", pkrPerUnit: 100, source: "test", status: "manual" };
const GBP: FxQuote = { currency: "GBP", pkrPerUnit: 200, source: "test", status: "manual" };

describe("currency", () => {
  it("formats buyer currencies and PKR differently", () => {
    expect(formatMoney(1234_50, "USD")).toBe("$1,234.50");
    expect(formatMoney(1234_00, "USD")).toBe("$1,234");
    expect(formatMoney(99_00, "GBP")).toBe("£99");
    expect(formatMoney(45_000_00, "PKR")).toBe("Rs 45,000");
  });

  it("converts PKR into buyer currencies and across currencies", () => {
    expect(convertFromPkr(10_000_00, USD)).toBe(100_00);
    expect(convert(100_00, GBP, USD)).toBe(200_00);
  });

  it("defaults overseas buyers to their destination's currency and buyers in Pakistan to PKR", () => {
    expect(defaultCurrencyFor("GB")).toBe("GBP");
    expect(defaultCurrencyFor("CA")).toBe("CAD");
    expect(defaultCurrencyFor("US")).toBe("USD");
    expect(defaultCurrencyFor("PK")).toBe("PKR");
    expect(defaultCurrencyFor("FR")).toBe("USD");
    expect(defaultCurrencyFor(null)).toBe("USD");
  });

  it("keeps Pakistan out of the import destinations but lets buyers pick it", () => {
    expect(isDestination("PK")).toBe(false);
    expect(isBuyerDestination("PK")).toBe(true);
    expect(DESTINATIONS.map((d) => d.code)).toEqual(["US", "GB", "CA"]);
    expect(BUYER_DESTINATIONS.map((d) => d.code)).toEqual(["US", "GB", "CA", "PK"]);
    expect(destinationName("PK")).toBe("Pakistan");
  });
});
