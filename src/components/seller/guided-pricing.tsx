import { computeLandedCost } from "@/lib/commerce/landed-cost";
import { getRateContext } from "@/lib/commerce/rates";
import { getSetting } from "@/lib/settings";
import { DESTINATIONS, applyBps, formatMoney, type FxQuote } from "@/lib/money/currency";
import { Badge } from "@/components/ui/misc";

const PKR: FxQuote = { currency: "PKR", pkrPerUnit: 1, source: "identity", status: "live" };

/**
 * Guided pricing for artisans, entirely in rupees: what you receive, and what a
 * buyer in each country pays once shipping, duty and fees are added (converted
 * back to PKR so this page never mixes currencies).
 */
export async function GuidedPricing({
  product,
}: {
  product: {
    id: string;
    vendorId: string;
    categoryId: string;
    title: string;
    pricePkr: number;
    weightG: number | null;
    availability: "ready_to_ship" | "made_to_order";
    timeToMakeDays: number | null;
    dispatchDays: number | null;
    hsCodeOverride: string | null;
  };
}) {
  const commission = await getSetting("commission");
  const rows = await Promise.all(
    DESTINATIONS.map(async (dest) => {
      const rates = await getRateContext(dest.code);
      const lc = computeLandedCost({
        items: [
          {
            productId: product.id,
            vendorId: product.vendorId,
            categoryId: product.categoryId,
            hsCode: product.hsCodeOverride,
            title: product.title,
            unitPricePkr: product.pricePkr,
            qty: 1,
            weightG: product.weightG,
            availability: product.availability,
            timeToMakeDays: product.timeToMakeDays,
            dispatchDays: product.dispatchDays,
          },
        ],
        destination: dest.code,
        fx: PKR,
        fxTable: rates.fxTable,
        shippingRates: rates.shippingRates,
        dutyRates: rates.dutyRates,
        handling: rates.handling,
      });
      return { dest, lc };
    }),
  );
  const fee = commission.status === "active" ? applyBps(product.pricePkr, commission.defaultBps) : null;
  return (
    <div className="space-y-4">
      <div className="bg-gold-50 ring-gold-200 rounded-2xl p-4 ring-1">
        <p className="text-gold-800 text-xs font-semibold tracking-wider uppercase">You receive</p>
        <p className="font-display text-umber-900 mt-1 text-3xl">
          {fee == null ? formatMoney(product.pricePkr, "PKR") : formatMoney(product.pricePkr - fee, "PKR")}
        </p>
        <p className="text-umber-600 mt-1 text-xs">
          {fee == null
            ? "Your listed price. Wahbayaan's commission rate hasn't been set yet — it will be shown here before any payout."
            : `Your price ${formatMoney(product.pricePkr, "PKR")} minus Wahbayaan commission ${formatMoney(fee, "PKR")}.`}
        </p>
      </div>
      <div className="space-y-2">
        <p className="text-umber-500 text-xs font-semibold tracking-wider uppercase">What an international buyer pays (in rupees)</p>
        {rows.map(({ dest, lc }) => (
          <div key={dest.code} className="bg-sand-50 ring-umber-200/70 rounded-xl px-3 py-2.5 ring-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-umber-800 font-medium">{dest.name}</span>
              <span className="text-umber-900 tabular-nums">
                {formatMoney(lc.knownTotal, "PKR")}
                {!lc.complete ? <span className="text-umber-400"> +</span> : null}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {lc.lines
                .filter((l) => l.key !== "items")
                .map((l) => (
                  <Badge key={l.key} tone={l.status === "pending" ? "pending" : "neutral"}>
                    {l.label}: {l.status === "pending" ? "pending" : l.status === "not_applicable" ? "n/a" : formatMoney(l.amount ?? 0, "PKR")}
                  </Badge>
                ))}
            </div>
          </div>
        ))}
        <p className="text-umber-500 text-xs">
          Buyers see these amounts in their own currency. Lines marked pending are confirmed by our team once courier and customs rates are in place — you
          don&apos;t need to include them in your price.
          {!product.weightG ? " Add the packed weight so shipping can be quoted." : ""}
        </p>
      </div>
    </div>
  );
}
