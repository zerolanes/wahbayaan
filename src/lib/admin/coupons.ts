import { isBuyerCurrency, type Currency } from "@/lib/money/currency";
import { orderMoney } from "./money";

/**
 * Coupon rules (pure). The cart applies a coupon as either a percentage of
 * the items subtotal or a fixed amount in a buyer currency, converted at the
 * current rate into whatever currency the buyer checks out in.
 */

export type CouponInput = {
  code: string;
  kind: "percent" | "fixed";
  percentBps: number | null;
  amount: number | null;
  currency: string | null;
  minSubtotal: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  maxUses: number | null;
};

export type CouponRow = CouponInput & { isActive: boolean; usedCount: number; description?: string | null };

export type CouponState = "active" | "scheduled" | "expired" | "exhausted" | "disabled";

/** Codes are stored upper-case — the cart upper-cases what buyers type. */
export function normalizeCouponCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "-");
}

export function validateCoupon(input: CouponInput): string | null {
  const code = normalizeCouponCode(input.code);
  if (!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(code)) return "Use 3–40 letters, numbers, dashes or underscores for the code.";
  if (input.kind === "percent") {
    if (input.percentBps == null) return "Enter the percentage off.";
    if (input.percentBps <= 0 || input.percentBps > 9_000) return "A percentage coupon must be between 0.01% and 90%.";
  } else {
    if (input.amount == null || input.amount <= 0) return "Enter the amount off.";
    if (!input.currency || !isBuyerCurrency(input.currency)) return "Choose the currency the fixed amount is in.";
  }
  if (input.minSubtotal != null && input.minSubtotal > 0 && (!input.currency || !isBuyerCurrency(input.currency))) return "A minimum order needs a currency.";
  if (input.kind === "fixed" && input.minSubtotal != null && input.amount != null && input.minSubtotal > 0 && input.amount >= input.minSubtotal)
    return "The amount off must be less than the minimum order.";
  if (input.startsAt && input.endsAt && input.endsAt <= input.startsAt) return "The end date must be after the start date.";
  if (input.maxUses != null && input.maxUses < 1) return "Maximum uses must be at least 1 (leave empty for unlimited).";
  return null;
}

export function couponState(c: Pick<CouponRow, "isActive" | "startsAt" | "endsAt" | "maxUses" | "usedCount">, now = new Date()): CouponState {
  if (!c.isActive) return "disabled";
  if (c.endsAt && c.endsAt < now) return "expired";
  if (c.maxUses != null && c.usedCount >= c.maxUses) return "exhausted";
  if (c.startsAt && c.startsAt > now) return "scheduled";
  return "active";
}

export const COUPON_STATE_TONE: Record<CouponState, "success" | "indigo" | "neutral" | "warning" | "danger"> = {
  active: "success",
  scheduled: "indigo",
  expired: "neutral",
  exhausted: "warning",
  disabled: "neutral",
};

/** "15% off" / "$25 USD off · orders over $200 USD". */
export function describeCoupon(c: Pick<CouponRow, "percentBps" | "amount" | "currency" | "minSubtotal"> & { kind: string }): string {
  const off = c.kind === "percent" ? `${+((c.percentBps ?? 0) / 100).toFixed(2)}% off` : c.amount != null && c.currency ? `${orderMoney(c.amount, c.currency as Currency)} off` : "Amount missing";
  const min = c.minSubtotal && c.currency ? ` · orders over ${orderMoney(c.minSubtotal, c.currency)}` : "";
  return off + min;
}

/** Share of the usage limit consumed (null when unlimited). */
export function usageShare(c: Pick<CouponRow, "maxUses" | "usedCount">): number | null {
  return c.maxUses ? Math.min(1, c.usedCount / c.maxUses) : null;
}
