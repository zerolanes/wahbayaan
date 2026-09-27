import "server-only";
import { getBuyerContext } from "@/lib/buyer-context";
import { buyerUnitPrice } from "@/lib/commerce/landed-cost";
import { formatMoney } from "@/lib/money/currency";
import { cn } from "@/lib/utils/cn";

/**
 * Buyer-facing price. Converts a PKR listing price into the buyer's currency
 * (USD/GBP/CAD, or PKR only when the buyer chose it in the switcher).
 *
 * Only for storefront pages. Seller and admin pages use <SellerPrice>.
 */
export async function BuyerPrice({ pkr, className, strike }: { pkr: number; className?: string; strike?: boolean }) {
  const ctx = await getBuyerContext();
  if (!ctx.fx) {
    return (
      <span className={cn("text-umber-500", className)} title="Exchange rate not set yet">
        Price on request
      </span>
    );
  }
  const amount = buyerUnitPrice(pkr, ctx.fx);
  return (
    <span className={cn("tabular-nums", strike && "text-umber-400 line-through", className)}>
      {formatMoney(amount, ctx.currency)}
      {ctx.fx.status === "placeholder" && !strike ? (
        <sup className="ml-0.5 text-[0.6em] text-pending-600" title="Indicative — converted with a placeholder exchange rate, not a live rate">
          ≈
        </sup>
      ) : null}
    </span>
  );
}

/** Format an amount already in the buyer's currency (e.g. landed-cost lines). */
export async function buyerMoney(minor: number) {
  const ctx = await getBuyerContext();
  return formatMoney(minor, ctx.currency);
}
