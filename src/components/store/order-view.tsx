import { Check } from "lucide-react";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/lib/commerce/orders";
import { ORDER_JOURNEY, orderCostLines, orderJourneyStep, type OrderCostSource } from "@/lib/commerce/order-view";
import { destinationName, formatMoney, type Currency } from "@/lib/money/currency";
import { Badge } from "@/components/ui/misc";
import { cn } from "@/lib/utils/cn";

export function OrderStatusBadge({ status }: { status: string }) {
  return <Badge tone={ORDER_STATUS_TONE[status] ?? "neutral"}>{ORDER_STATUS_LABEL[status] ?? status}</Badge>;
}

/** Landed cost for a placed order — as charged, or as known so far with pending lines. */
export function OrderCostSummary({ order, className, title = "Landed cost" }: { order: OrderCostSource & { currency: string; destinationCountry: string }; className?: string; title?: string }) {
  const currency = order.currency as Currency;
  const view = orderCostLines(order);
  return (
    <div className={cn("rounded-2xl bg-sand-50 ring-1 ring-umber-200/70", className)}>
      <div className="flex items-center justify-between border-b border-umber-200/60 px-4 py-3">
        <p className="text-sm font-semibold text-umber-900">{title}</p>
        <p className="text-xs text-umber-500">Shipping to {destinationName(order.destinationCountry)}</p>
      </div>
      <dl className="divide-y divide-umber-200/50 px-4">
        {view.lines.map((l) => (
          <div key={l.key} className="py-2.5">
            <div className="flex items-center justify-between gap-4 text-sm">
              <dt className="text-umber-700">{l.label}</dt>
              <dd>
                {l.status === "pending" ? (
                  <span className="rounded-full bg-pending-50 px-2 py-0.5 text-xs font-medium text-pending-600 ring-1 ring-pending-600/20 ring-inset">Pending</span>
                ) : l.status === "not_applicable" ? (
                  <span className="text-umber-400">—</span>
                ) : (
                  <span className={cn("tabular-nums", l.key === "discount" && "text-success-700")}>{formatMoney(l.amount ?? 0, currency, { cents: true })}</span>
                )}
              </dd>
            </div>
            {l.note && l.status !== "known" ? <p className="mt-0.5 text-xs text-umber-500">{l.note}</p> : null}
          </div>
        ))}
      </dl>
      <div className="flex items-baseline justify-between gap-4 rounded-b-2xl border-t border-umber-200/70 bg-sand-100/70 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-umber-900">{view.complete ? "Total" : "Known so far"}</p>
          {!view.complete ? <p className="text-xs text-umber-500">Pending lines are confirmed before you&apos;re charged</p> : null}
        </div>
        <p className="font-display text-2xl whitespace-nowrap text-umber-900 tabular-nums">
          {formatMoney(view.total, currency, { cents: true })}
          {!view.complete ? <span className="text-base text-umber-400"> +</span> : null}
        </p>
      </div>
    </div>
  );
}

/** The buyer-facing journey from order to artisan payout, with the current step highlighted. */
export function OrderJourney({ status, className, dark }: { status: string; className?: string; dark?: boolean }) {
  const current = orderJourneyStep(status);
  const quoting = status === "awaiting_quote" || status === "quote_sent";
  return (
    <ol className={cn("relative space-y-0", className)}>
      {ORDER_JOURNEY.map((s, i) => {
        const done = current > i || status === "completed";
        const active = current === i && status !== "completed";
        return (
          <li key={s.key} className="relative flex gap-4 pb-6 last:pb-0">
            {i < ORDER_JOURNEY.length - 1 ? (
              <span aria-hidden className={cn("absolute top-7 left-[13px] h-[calc(100%-1.5rem)] w-px", done ? "bg-gold-500" : dark ? "bg-white/15" : "bg-umber-200")} />
            ) : null}
            <span
              className={cn(
                "relative z-10 grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold",
                done ? "bg-gold-500 text-ink" : active ? (dark ? "bg-sand-50 text-indigo-950 ring-4 ring-gold-400/40" : "bg-indigo-900 text-sand-50 ring-4 ring-gold-200") : dark ? "bg-white/10 text-sand-200/60" : "bg-umber-100 text-umber-500",
              )}
            >
              {done ? <Check className="size-4" aria-hidden /> : i + 1}
            </span>
            <div className="pt-0.5">
              <p className={cn("text-sm font-semibold", dark ? (active || done ? "text-sand-50" : "text-sand-200/60") : active || done ? "text-umber-900" : "text-umber-500")}>
                {i === 0 && quoting ? "Order placed — confirming costs" : s.label}
                {active ? <span className="sr-only"> (current step)</span> : null}
              </p>
              <p className={cn("mt-0.5 text-xs", dark ? "text-sand-200/60" : "text-umber-500")}>
                {i === 0 && quoting ? "We confirm shipping and import costs; you approve the total before paying." : s.detail}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
