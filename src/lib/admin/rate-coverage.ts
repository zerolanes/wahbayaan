/**
 * Coverage of the landed-cost rate tables: which destination × weight band,
 * destination × craft and currency combinations can actually be quoted.
 * Pure functions so the admin pages, the health check and tests agree.
 */

export type ConfigStatus = "pending" | "active" | "disabled";
export type CellState = "active" | "pending" | "disabled" | "missing";

export type ShipRow = {
  courier: string;
  destinationCountry: string;
  minWeightG: number;
  maxWeightG: number;
  amount: number | null;
  status: ConfigStatus;
};

export type Band = { minWeightG: number; maxWeightG: number };
export type ShipCell = { destination: string; band: Band; state: CellState; activeCouriers: number; totalCouriers: number };

export const bandKey = (b: Band) => `${b.minWeightG}-${b.maxWeightG}`;

export function bandLabel(b: Band) {
  // Bands are stored inclusive in grams (0–2000, 2001–5000); show them as 0–2 kg, 2–5 kg.
  const kg = (g: number) => String(+(g / 1000).toFixed(2));
  return `${kg(b.minWeightG)}–${kg(b.maxWeightG)} kg`;
}

/** A rate row counts only when it is active *and* has an amount (never quote a blank as zero). */
export const isQuotable = (r: { status: ConfigStatus; amount: number | null }) => r.status === "active" && r.amount != null;

function cellState(rows: { status: ConfigStatus; amount: number | null }[]): CellState {
  if (!rows.length) return "missing";
  if (rows.some(isQuotable)) return "active";
  if (rows.every((r) => r.status === "disabled")) return "disabled";
  return "pending";
}

/** Distinct weight bands across all rows, lightest first. */
export function shippingBands(rows: readonly ShipRow[]): Band[] {
  const seen = new Map<string, Band>();
  for (const r of rows) seen.set(bandKey(r), { minWeightG: r.minWeightG, maxWeightG: r.maxWeightG });
  return [...seen.values()].sort((a, b) => a.minWeightG - b.minWeightG || a.maxWeightG - b.maxWeightG);
}

/** Destination × weight band matrix. */
export function shippingCoverage(rows: readonly ShipRow[], destinations: readonly string[]) {
  const bands = shippingBands(rows);
  const cells: ShipCell[] = [];
  for (const destination of destinations)
    for (const band of bands) {
      const inCell = rows.filter((r) => r.destinationCountry === destination && r.minWeightG === band.minWeightG && r.maxWeightG === band.maxWeightG);
      cells.push({ destination, band, state: cellState(inCell), activeCouriers: inCell.filter(isQuotable).length, totalCouriers: inCell.length });
    }
  const active = cells.filter((c) => c.state === "active").length;
  return { bands, cells, active, total: cells.length, pending: cells.filter((c) => c.state !== "active") };
}

/**
 * Weight ranges (grams, inclusive) between 0 and `upToG` with no quotable rate
 * for one destination. Bands are inclusive and may be written as 0–2000,
 * 2001–5000, so a gap of one gram between bands is not a gap.
 */
export function weightGaps(rows: readonly ShipRow[], destination: string, upToG: number): Band[] {
  const ranges = rows
    .filter((r) => r.destinationCountry === destination && isQuotable(r))
    .map((r) => [r.minWeightG, r.maxWeightG] as const)
    .sort((a, b) => a[0] - b[0]);
  const gaps: Band[] = [];
  let cursor = 0; // first gram not yet covered
  for (const [min, max] of ranges) {
    if (min > cursor + 1) gaps.push({ minWeightG: cursor, maxWeightG: Math.min(min - 1, upToG) });
    cursor = Math.max(cursor, max);
    if (cursor >= upToG) break;
  }
  if (cursor < upToG) gaps.push({ minWeightG: ranges.length ? cursor + 1 : 0, maxWeightG: upToG });
  return gaps.filter((g) => g.minWeightG <= g.maxWeightG && g.minWeightG <= upToG);
}

// ── Duty ────────────────────────────────────────────────────────────────────

export type DutyRow = {
  destinationCountry: string;
  categoryId: string | null;
  hsCode: string | null;
  dutyPercent: string | number | null;
  status: ConfigStatus;
};

export type DutyCell = { destination: string; categoryId: string; state: CellState; via: "category" | "country" | null };

/** Mirrors the landed-cost lookup (category row, else a country-wide row) for listings without an HS override. */
export function dutyCoverage(rows: readonly DutyRow[], destinations: readonly string[], categoryIds: readonly string[]) {
  const cells: DutyCell[] = [];
  for (const destination of destinations) {
    const forCountry = rows.filter((r) => r.destinationCountry === destination && r.status !== "disabled");
    for (const categoryId of categoryIds) {
      const cat = forCountry.find((r) => r.categoryId === categoryId && !r.hsCode);
      const all = forCountry.find((r) => r.categoryId == null && !r.hsCode);
      const hit = cat ?? all;
      const state: CellState = !hit
        ? rows.some((r) => r.destinationCountry === destination && r.categoryId === categoryId && r.status === "disabled")
          ? "disabled"
          : "missing"
        : hit.status === "active" && hit.dutyPercent != null && hit.dutyPercent !== ""
          ? "active"
          : "pending";
      cells.push({ destination, categoryId, state, via: cat ? "category" : all ? "country" : null });
    }
  }
  const active = cells.filter((c) => c.state === "active").length;
  return { cells, active, total: cells.length, pending: cells.filter((c) => c.state !== "active") };
}

// ── Import rules ────────────────────────────────────────────────────────────

export type RuleRow = { destinationCountry: string; categoryId: string | null; status: ConfigStatus; level: string };

/** A destination × craft is "reviewed" once at least one active rule applies to it (category-specific or country-wide). */
export function ruleCoverage(rows: readonly RuleRow[], destinations: readonly string[], categoryIds: readonly string[]) {
  const cells = destinations.flatMap((destination) =>
    categoryIds.map((categoryId) => {
      const applicable = rows.filter((r) => r.destinationCountry === destination && r.status === "active" && (r.categoryId === categoryId || r.categoryId == null));
      const worst = ["prohibited", "restricted", "warning", "info"].find((l) => applicable.some((r) => r.level === l)) ?? null;
      return { destination, categoryId, reviewed: applicable.length > 0, rules: applicable.length, worst };
    }),
  );
  const reviewed = cells.filter((c) => c.reviewed).length;
  return { cells, reviewed, total: cells.length };
}

// ── FX ──────────────────────────────────────────────────────────────────────

export type FxState = "placeholder" | "missing" | "stale" | "fresh";

/** Live rates are stale after 48 h (the daily refresh failed); manual rates after 14 days. */
export const FX_STALE_HOURS = { live: 48, manual: 24 * 14 } as const;

export function fxFreshness(row: { status: "placeholder" | "manual" | "live"; updatedAt: Date } | null | undefined, now = new Date()) {
  if (!row) return { state: "missing" as FxState, ageHours: null };
  const ageHours = Math.max(0, (now.getTime() - new Date(row.updatedAt).getTime()) / 3_600_000);
  if (row.status === "placeholder") return { state: "placeholder" as FxState, ageHours };
  return { state: (ageHours > FX_STALE_HOURS[row.status] ? "stale" : "fresh") as FxState, ageHours };
}

export function formatAge(hours: number | null) {
  if (hours == null) return "—";
  if (hours < 1) return "under an hour";
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} days`;
}

export function percentOf(n: number, total: number) {
  return total ? Math.round((n / total) * 100) : 0;
}
