import { describe, expect, it } from "vitest";
import { csvAmount, csvCell, toCsv } from "@/lib/admin/csv";
import { bpsToPercentString, minorToInput, orderMoney, parseMoneyInput, percentToBps, sumByCurrency } from "@/lib/admin/money";
import { dateRange, hrefWith, int, oneOf, pageOf, str } from "@/lib/admin/params";
import { dailySeries, groupSum, median, niceMax, percent, ratio, rollup } from "@/lib/admin/series";
import { formToObject } from "@/lib/admin/zod";

describe("CSV encoding", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
    expect(csvCell(null)).toBe("");
    expect(csvCell(12)).toBe("12");
  });
  it("neutralises spreadsheet formulas but keeps negative numbers", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("@SUM")).toBe("'@SUM");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell(-5)).toBe("-5");
  });
  it("joins arrays and serialises dates", () => {
    expect(csvCell(["wool", "silk"])).toBe("wool; silk");
    expect(csvCell(new Date("2026-01-02T03:04:05.000Z"))).toBe("2026-01-02T03:04:05.000Z");
  });
  it("builds a CSV document with a header row", () => {
    const csv = toCsv([{ a: 1, b: "x,y" }], [
      { header: "A", value: (r) => r.a },
      { header: "B", value: (r) => r.b },
    ]);
    expect(csv).toBe('A,B\r\n1,"x,y"\r\n');
  });
  it("formats minor units as plain decimals", () => {
    expect(csvAmount(123456)).toBe("1234.56");
    expect(csvAmount(-5)).toBe("-0.05");
    expect(csvAmount(null)).toBe("");
  });
});

describe("money input", () => {
  it("parses typed amounts into minor units", () => {
    expect(parseMoneyInput("1,250.50")).toBe(125050);
    expect(parseMoneyInput("Rs 900")).toBe(90000);
    expect(parseMoneyInput("$12.5")).toBe(1250);
    expect(parseMoneyInput("0")).toBe(0);
    expect(parseMoneyInput("")).toBeNull();
    expect(parseMoneyInput("12.345")).toBeNaN();
    expect(parseMoneyInput("abc")).toBeNaN();
  });
  it("round-trips to input values", () => {
    expect(minorToInput(125050)).toBe("1250.50");
    expect(minorToInput(90000)).toBe("900");
    expect(minorToInput(null)).toBe("");
  });
  it("always shows the currency code on buyer amounts", () => {
    expect(orderMoney(125000, "USD")).toBe("$1,250 USD");
    expect(orderMoney(4999, "GBP")).toBe("£49.99 GBP");
    expect(orderMoney(null, "USD")).toBe("—");
  });
  it("converts percentages and basis points", () => {
    expect(percentToBps("12.5")).toBe(1250);
    expect(percentToBps("")).toBeNull();
    expect(percentToBps("x")).toBeNaN();
    expect(bpsToPercentString(1250)).toBe("12.5");
  });
  it("sums per currency without mixing", () => {
    const rows = [
      { c: "USD", a: 100 },
      { c: "GBP", a: 50 },
      { c: "USD", a: 25 },
    ];
    expect(sumByCurrency(rows, (r) => r.c, (r) => r.a)).toEqual([
      { currency: "GBP", total: 50 },
      { currency: "USD", total: 125 },
    ]);
  });
});

describe("search params", () => {
  it("reads first values and defaults", () => {
    expect(str({ q: [" a ", "b"] }, "q")).toBe("a");
    expect(int({ n: "x" }, "n", 5)).toBe(5);
    expect(pageOf({ page: "-3" })).toBe(1);
    expect(oneOf({ s: "bad" }, "s", ["a", "b"] as const, "a")).toBe("a");
  });
  it("builds hrefs that reset paging when filters change", () => {
    expect(hrefWith("/admin/orders", { q: "x", page: "3" }, { status: "paid" })).toBe("/admin/orders?q=x&status=paid");
    expect(hrefWith("/admin/orders", { q: "x" }, { page: 2 })).toBe("/admin/orders?q=x&page=2");
    expect(hrefWith("/admin/orders", { q: "x" }, { q: null })).toBe("/admin/orders");
  });
  it("computes inclusive date ranges", () => {
    const r = dateRange({ from: "2026-01-01", to: "2026-01-31" }, 30);
    expect(r.days).toBe(31);
    expect(r.toExclusive.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    const swapped = dateRange({ from: "2026-02-01", to: "2026-01-01" }, 30);
    expect(swapped.fromStr).toBe("2026-01-01");
    const def = dateRange({}, 7, new Date("2026-03-10T15:00:00Z"));
    expect(def.fromStr).toBe("2026-03-04");
    expect(def.toStr).toBe("2026-03-10");
  });
});

describe("report aggregation", () => {
  it("fills daily gaps with zero", () => {
    const s = dailySeries([{ at: "2026-01-02T10:00:00Z" }, { at: "2026-01-02T11:00:00Z", value: 2 }, { at: "2025-12-01T00:00:00Z" }], new Date("2026-01-01T00:00:00Z"), 3);
    expect(s.map((p) => p.value)).toEqual([0, 3, 0]);
    expect(s[0].key).toBe("2026-01-01");
  });
  it("rolls days into weeks", () => {
    const s = dailySeries([], new Date("2026-01-01T00:00:00Z"), 10).map((p, i) => ({ ...p, value: i }));
    expect(rollup(s, 7).map((p) => p.value)).toEqual([21, 24]);
  });
  it("picks nice axis maxima", () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(7)).toBe(10);
    expect(niceMax(180)).toBe(200);
    expect(niceMax(2300)).toBe(2500);
  });
  it("groups, ranks and summarises", () => {
    expect(groupSum([{ k: "a", v: 1 }, { k: "b", v: 5 }, { k: "a", v: 2 }], (r) => r.k, (r) => r.v)).toEqual([
      { key: "b", value: 5 },
      { key: "a", value: 3 },
    ]);
    expect(ratio(1, 0)).toBeNull();
    expect(percent(ratio(1, 4))).toBe("25.0%");
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("form parsing", () => {
  it("turns repeated keys and [] keys into arrays", () => {
    const fd = new FormData();
    fd.append("name", "x");
    fd.append("ids[]", "1");
    fd.append("tag", "a");
    fd.append("tag", "b");
    expect(formToObject(fd)).toEqual({ name: "x", ids: ["1"], tag: ["a", "b"] });
  });
});
