import { formatMoney } from "@/lib/money/currency";
import { cn } from "@/lib/utils/cn";

/**
 * Seller-facing amount — always Pakistani rupees. For the seller dashboard and
 * admin finance views. Never use on storefront pages.
 */
export function SellerPrice({ pkr, className, compact }: { pkr: number | null | undefined; className?: string; compact?: boolean }) {
  if (pkr == null) return <span className={cn("text-umber-400", className)}>—</span>;
  return <span className={cn("tabular-nums", className)}>{formatMoney(pkr, "PKR", { compact })}</span>;
}
