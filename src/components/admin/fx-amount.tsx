import type { FxTable } from "@/lib/commerce/rates";
import { orderMoney } from "@/lib/admin/money";
import { PendingBadge } from "./ui";

/**
 * A PKR amount shown in a buyer currency at today's rate, e.g. "≈ $536 USD".
 * Missing rates show as pending (never 0); placeholder rates are labelled.
 */
export function BuyerEquivalent({ pkr, currency, fx, className }: { pkr: number | null | undefined; currency: string | null | undefined; fx: FxTable; className?: string }) {
  if (pkr == null || !currency) return null;
  if (currency === "PKR") return null;
  const rate = fx[currency];
  if (!rate || !(rate.pkrPerUnit > 0)) return <PendingBadge>{currency} rate pending</PendingBadge>;
  const amount = Math.round(pkr / rate.pkrPerUnit);
  return (
    <span className={className} title={`At ${rate.pkrPerUnit.toFixed(2)} PKR per ${currency} (${rate.source})`}>
      ≈ {orderMoney(amount, currency)}
      {rate.status === "placeholder" ? <span className="ml-1 text-[11px] text-pending-600">placeholder rate</span> : null}
    </span>
  );
}

/** Buyer-currency amount → PKR at today's rate (null when the rate is missing). */
export function toPkrToday(minor: number, currency: string, fx: FxTable): number | null {
  if (currency === "PKR") return minor;
  const rate = fx[currency];
  return rate && rate.pkrPerUnit > 0 ? Math.round(minor * rate.pkrPerUnit) : null;
}
