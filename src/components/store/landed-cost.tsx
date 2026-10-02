import { Clock, Info, Truck } from "lucide-react";
import type { DeliveryEstimate, LandedCost, LcLine } from "@/lib/commerce/landed-cost";
import { destinationName, formatMoney } from "@/lib/money/currency";
import { cn } from "@/lib/utils/cn";

function LineAmount({ line, currency }: { line: LcLine; currency: LandedCost["currency"] }) {
  if (line.status === "pending")
    return <span className="rounded-full bg-pending-50 px-2 py-0.5 text-xs font-medium text-pending-600 ring-1 ring-pending-600/20 ring-inset">Pending</span>;
  if (line.status === "not_applicable") return <span className="text-umber-400">—</span>;
  if (line.amount === 0) return <span className="font-medium text-success-700">{formatMoney(0, currency, { cents: false })}</span>;
  return <span className={cn("tabular-nums", line.key === "discount" && "text-success-700")}>{formatMoney(line.amount ?? 0, currency, { cents: true })}</span>;
}

/**
 * Itemised landed cost: item + shipping + duty + import tax + handling (+ gift
 * wrap − discount). Lines without real rate data are labelled "Pending"; the
 * total is then presented as "known so far" rather than as a final figure.
 */
export function LandedCostBreakdown({ landed, className, title = "Landed cost", compact }: { landed: LandedCost; className?: string; title?: string; compact?: boolean }) {
  const { currency } = landed;
  return (
    <div className={cn("rounded-2xl bg-sand-50 ring-1 ring-umber-200/70", className)}>
      <div className="flex items-center justify-between border-b border-umber-200/60 px-4 py-3">
        <p className="text-sm font-semibold text-umber-900">{title}</p>
        <p className="text-xs text-umber-500">Shipping to {destinationName(landed.destination)}</p>
      </div>
      <dl className="divide-y divide-umber-200/50 px-4">
        {landed.lines.map((line) => (
          <div key={line.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 py-2.5 text-sm">
            <dt className="text-umber-700">{line.label}</dt>
            <dd>
              <LineAmount line={line} currency={currency} />
            </dd>
            {line.note && !compact ? <dd className="col-span-2 mt-0.5 text-xs text-umber-500">{line.note}</dd> : null}
          </div>
        ))}
      </dl>
      <div className="flex items-baseline justify-between gap-4 rounded-b-2xl border-t border-umber-200/70 bg-sand-100/70 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-umber-900">{landed.complete ? "Total to pay" : "Known so far"}</p>
          {!landed.complete ? (
            <p className="text-xs text-umber-500">
              + {landed.pendingLines.length} pending {landed.pendingLines.length === 1 ? "line" : "lines"}, confirmed before you&apos;re charged
            </p>
          ) : null}
        </div>
        <p className="font-display text-2xl whitespace-nowrap text-umber-900 tabular-nums">
          {formatMoney(landed.knownTotal, currency, { cents: true })}
          {!landed.complete ? <span className="text-base text-umber-400"> +</span> : null}
        </p>
      </div>
      {landed.fx.status === "placeholder" ? (
        <p className="flex gap-1.5 px-4 pt-2 pb-3 text-xs text-pending-600">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Converted from Pakistani rupees with a placeholder exchange rate — not a live rate.
        </p>
      ) : currency !== "PKR" ? (
        <p className="px-4 pt-2 pb-3 text-xs text-umber-500">
          Listed by the artisan in Pakistani rupees; shown in {currency} at today&apos;s rate.
        </p>
      ) : null}
    </div>
  );
}

export function DeliveryEstimateLine({ delivery, className }: { delivery: DeliveryEstimate; className?: string }) {
  const prod = delivery.productionDaysMax;
  const tMin = delivery.transitDaysMin;
  const tMax = delivery.transitDaysMax;
  return (
    <div className={cn("space-y-1.5 text-sm text-umber-700", className)}>
      <p className="flex items-center gap-2">
        <Clock className="size-4 text-gold-600" aria-hidden />
        {prod != null ? (
          <span>
            Leaves the workshop in <strong className="text-umber-900">{prod === 0 ? "1 day" : `${prod} days`}</strong>
          </span>
        ) : (
          <span className="text-umber-500">Making / dispatch time not stated by the artisan</span>
        )}
      </p>
      <p className="flex items-center gap-2">
        <Truck className="size-4 text-gold-600" aria-hidden />
        {tMax != null ? (
          <span>
            Courier transit <strong className="text-umber-900">{tMin && tMin !== tMax ? `${tMin}–${tMax}` : tMax} days</strong>
            {prod != null ? (
              <span className="text-umber-500">
                {" "}
                · arrives in about {prod + (tMin ?? tMax)}–{prod + tMax} days
              </span>
            ) : null}
          </span>
        ) : (
          <span className="text-umber-500">Transit time pending courier rates for your country</span>
        )}
      </p>
    </div>
  );
}
