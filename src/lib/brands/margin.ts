/**
 * Wahbayaan's margin on Pakistani Brands orders, shown to the buyer as its own
 * "Wahbayaan service fee" line — never folded into the item price.
 *
 * Configured separately for domestic orders (delivered inside Pakistan) and
 * international ones, in one of two modes:
 * - `tiers`: a fixed PKR fee per order-value band. Values outside every band use
 *   the optional percentage fallback, otherwise the fee is pending.
 * - `percent`: a percentage of the items subtotal, optionally clamped by a
 *   minimum and maximum PKR fee.
 *
 * All amounts are PKR minor units (paisa). Pure.
 */
import { applyBps } from "@/lib/money/currency";

export type MarginTier = { minPkr: number; maxPkr: number | null; feePkr: number | null };

export type MarginRule = {
  status: "pending" | "active";
  mode: "tiers" | "percent";
  tiers: MarginTier[];
  /** Percent mode: the rate. Tiers mode: optional fallback for values outside every band. */
  percentBps: number | null;
  minFeePkr: number | null;
  maxFeePkr: number | null;
  note: string | null;
};

export type BrandMarginSetting = { domestic: MarginRule; international: MarginRule };

export type ServiceFee =
  | { status: "known"; feePkr: number; basis: string }
  | { status: "pending"; reason: string };

const rs = (minor: number) => `Rs ${Math.round(minor / 100).toLocaleString("en-PK")}`;

export function describeTier(t: MarginTier) {
  const range = t.maxPkr == null ? `${rs(t.minPkr)} and above` : `${rs(t.minPkr)} – ${rs(t.maxPkr)}`;
  return `${range}: ${t.feePkr == null ? "pending" : rs(t.feePkr)}`;
}

/** The service fee for an order whose items total `itemsSubtotalPkr`. */
export function computeServiceFee(rule: MarginRule, itemsSubtotalPkr: number): ServiceFee {
  if (rule.status !== "active") return { status: "pending", reason: "service fee not yet set" };
  if (!(itemsSubtotalPkr > 0)) return { status: "pending", reason: "no items" };

  const clamp = (fee: number) => {
    let f = fee;
    if (rule.minFeePkr != null) f = Math.max(f, rule.minFeePkr);
    if (rule.maxFeePkr != null) f = Math.min(f, rule.maxFeePkr);
    return f;
  };
  const percent = (): ServiceFee | null =>
    rule.percentBps != null && rule.percentBps > 0
      ? { status: "known", feePkr: clamp(applyBps(itemsSubtotalPkr, rule.percentBps)), basis: `${rule.percentBps / 100}% of the items` }
      : null;

  if (rule.mode === "percent") return percent() ?? { status: "pending", reason: "percentage not set" };

  const tier = rule.tiers.find((t) => itemsSubtotalPkr >= t.minPkr && (t.maxPkr == null || itemsSubtotalPkr <= t.maxPkr));
  if (tier) {
    if (tier.feePkr == null) return { status: "pending", reason: `fee for orders of ${describeTier(tier).split(":")[0]} not yet set` };
    return { status: "known", feePkr: tier.feePkr, basis: `fixed fee for orders of ${describeTier(tier).split(":")[0]}` };
  }
  return percent() ?? { status: "pending", reason: "no fee band covers this order value yet" };
}

/** Problems that make a rule unusable or ambiguous; shown in the admin before saving. */
export function validateMarginRule(rule: MarginRule): string | null {
  if (rule.mode === "percent") {
    if (rule.status === "active" && (rule.percentBps == null || rule.percentBps <= 0)) return "Set a percentage above 0, or leave the fee pending.";
  }
  const sorted = [...rule.tiers].sort((a, b) => a.minPkr - b.minPkr);
  for (const [i, t] of sorted.entries()) {
    if (t.maxPkr != null && t.maxPkr < t.minPkr) return `Band ${describeTier(t)} ends before it starts.`;
    if (t.feePkr != null && t.feePkr < 0) return "Fees can't be negative.";
    const next = sorted[i + 1];
    if (next && (t.maxPkr == null || t.maxPkr >= next.minPkr)) return `Bands overlap: ${describeTier(t)} and ${describeTier(next)}.`;
  }
  if (rule.minFeePkr != null && rule.maxFeePkr != null && rule.minFeePkr > rule.maxFeePkr) return "The minimum fee is above the maximum fee.";
  return null;
}

/**
 * The owner's starting point from the brief: "roughly Rs 100–200 on a
 * Rs 3,000–4,000 order" for domestic orders, split into two bands. Values
 * outside these bands stay pending until the owner decides; international
 * orders have no fee set yet.
 */
export const OWNER_STARTING_POINT_NOTE = "Owner's starting point (from the brief): roughly Rs 100–200 on a Rs 3,000–4,000 domestic order. Review before launch.";

export const DEFAULT_BRAND_MARGIN: BrandMarginSetting = {
  domestic: {
    status: "active",
    mode: "tiers",
    tiers: [
      { minPkr: 300_000, maxPkr: 349_999, feePkr: 10_000 },
      { minPkr: 350_000, maxPkr: 400_000, feePkr: 20_000 },
    ],
    percentBps: null,
    minFeePkr: null,
    maxFeePkr: null,
    note: OWNER_STARTING_POINT_NOTE,
  },
  international: { status: "pending", mode: "percent", tiers: [], percentBps: null, minFeePkr: null, maxFeePkr: null, note: null },
};
