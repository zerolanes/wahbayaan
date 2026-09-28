import { describe, expect, it } from "vitest";
import { bandLabel, dutyCoverage, formatAge, fxFreshness, ruleCoverage, shippingBands, shippingCoverage, weightGaps, type ShipRow } from "@/lib/admin/rate-coverage";

const ship = (p: Partial<ShipRow>): ShipRow => ({ courier: "DHL", destinationCountry: "US", minWeightG: 0, maxWeightG: 2000, amount: null, status: "pending", ...p });

describe("shipping coverage", () => {
  const rows = [
    ship({ amount: 900_000, status: "active" }),
    ship({ courier: "FedEx" }),
    ship({ minWeightG: 2001, maxWeightG: 5000 }),
    ship({ minWeightG: 2001, maxWeightG: 5000, courier: "FedEx", status: "active", amount: null }), // active but blank → not quotable
    ship({ destinationCountry: "GB", status: "disabled" }),
  ];

  it("lists distinct bands lightest first", () => {
    expect(shippingBands(rows).map(bandLabel)).toEqual(["0–2 kg", "2–5 kg"]);
  });

  it("marks a cell active only when a row is active with an amount", () => {
    const cov = shippingCoverage(rows, ["US", "GB", "CA"]);
    const cell = (dest: string, min: number) => cov.cells.find((c) => c.destination === dest && c.band.minWeightG === min)!;
    expect(cell("US", 0)).toMatchObject({ state: "active", activeCouriers: 1, totalCouriers: 2 });
    expect(cell("US", 2001).state).toBe("pending");
    expect(cell("GB", 0).state).toBe("disabled");
    expect(cell("CA", 0).state).toBe("missing");
    expect(cov.active).toBe(1);
    expect(cov.total).toBe(6);
    expect(cov.pending).toHaveLength(5);
  });

  it("finds weight gaps without treating inclusive band edges as gaps", () => {
    const active = [ship({ amount: 1, status: "active" }), ship({ minWeightG: 2001, maxWeightG: 5000, amount: 1, status: "active" })];
    expect(weightGaps(active, "US", 5000)).toEqual([]);
    expect(weightGaps(active, "US", 10_000)).toEqual([{ minWeightG: 5001, maxWeightG: 10_000 }]);
    expect(weightGaps([], "US", 70_000)).toEqual([{ minWeightG: 0, maxWeightG: 70_000 }]);
    expect(weightGaps([ship({ minWeightG: 1000, maxWeightG: 3000, amount: 1, status: "active" })], "US", 3000)).toEqual([{ minWeightG: 0, maxWeightG: 999 }]);
    // Pending rows never close a gap.
    expect(weightGaps([ship({ amount: 1 })], "US", 2000)).toEqual([{ minWeightG: 0, maxWeightG: 2000 }]);
  });
});

describe("duty coverage", () => {
  it("follows the landed-cost lookup: category row, else country-wide row", () => {
    const rows = [
      { destinationCountry: "US", categoryId: "rugs", hsCode: null, dutyPercent: "0", status: "active" as const },
      { destinationCountry: "US", categoryId: "stone", hsCode: null, dutyPercent: null, status: "active" as const },
      { destinationCountry: "GB", categoryId: null, hsCode: null, dutyPercent: "4", status: "active" as const },
      { destinationCountry: "CA", categoryId: "rugs", hsCode: null, dutyPercent: "8", status: "disabled" as const },
    ];
    const cov = dutyCoverage(rows, ["US", "GB", "CA"], ["rugs", "stone"]);
    const cell = (d: string, c: string) => cov.cells.find((x) => x.destination === d && x.categoryId === c)!;
    expect(cell("US", "rugs")).toMatchObject({ state: "active", via: "category" }); // 0% duty is a real rate
    expect(cell("US", "stone").state).toBe("pending"); // active but no duty % → still pending
    expect(cell("GB", "stone")).toMatchObject({ state: "active", via: "country" });
    expect(cell("CA", "rugs").state).toBe("disabled");
    expect(cell("CA", "stone").state).toBe("missing");
    expect(cov.active).toBe(3); // US rugs, GB rugs, GB stone
  });
});

describe("import-rule coverage", () => {
  it("counts a cell reviewed when an active category or country-wide rule applies", () => {
    const cov = ruleCoverage(
      [
        { destinationCountry: "US", categoryId: null, status: "active", level: "info" },
        { destinationCountry: "US", categoryId: "rugs", status: "active", level: "restricted" },
        { destinationCountry: "GB", categoryId: "rugs", status: "pending", level: "prohibited" },
      ],
      ["US", "GB"],
      ["rugs", "stone"],
    );
    expect(cov.cells.find((c) => c.destination === "US" && c.categoryId === "rugs")).toMatchObject({ reviewed: true, rules: 2, worst: "restricted" });
    expect(cov.cells.find((c) => c.destination === "US" && c.categoryId === "stone")).toMatchObject({ reviewed: true, rules: 1, worst: "info" });
    expect(cov.cells.find((c) => c.destination === "GB" && c.categoryId === "rugs")?.reviewed).toBe(false);
    expect(cov.reviewed).toBe(2);
  });
});

describe("FX freshness", () => {
  const now = new Date("2026-09-28T12:00:00Z");
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);
  it("flags placeholders, missing and stale rates", () => {
    expect(fxFreshness(null, now).state).toBe("missing");
    expect(fxFreshness({ status: "placeholder", updatedAt: hoursAgo(1) }, now).state).toBe("placeholder");
    expect(fxFreshness({ status: "live", updatedAt: hoursAgo(47) }, now).state).toBe("fresh");
    expect(fxFreshness({ status: "live", updatedAt: hoursAgo(49) }, now).state).toBe("stale");
    expect(fxFreshness({ status: "manual", updatedAt: hoursAgo(24 * 10) }, now).state).toBe("fresh");
    expect(fxFreshness({ status: "manual", updatedAt: hoursAgo(24 * 15) }, now).state).toBe("stale");
  });
  it("formats ages", () => {
    expect(formatAge(null)).toBe("—");
    expect(formatAge(0.2)).toBe("under an hour");
    expect(formatAge(5)).toBe("5 h");
    expect(formatAge(24 * 5)).toBe("5 days");
  });
});
