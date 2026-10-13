import { Check, ExternalLink, MapPin, Package, Truck, Warehouse } from "lucide-react";
import { approveExtraShipping, declineExtraShipping } from "@/app/actions/fulfilment";
import { HUB_JOURNEY, hubItemJourney } from "@/lib/fulfilment/journey";
import { parcelsHeadline, type FulfilmentPlan } from "@/lib/fulfilment/plan";
import type { HubParcelStatus } from "@/lib/fulfilment/consolidation";
import { formatMoney, type Currency } from "@/lib/money/currency";
import { formatDate } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

/**
 * Buyer-facing fulfilment pieces. Short copy; amounts only in the order's
 * (buyer's) currency.
 */

const days = (n: number) => (n <= 1 ? "1 day" : `${n} days`);

/** Cart / checkout: "Arrives in 2 parcels" or "Shipped together from our hub". */
export function FulfilmentPlanNote({ plan, className }: { plan: FulfilmentPlan; className?: string }) {
  if (plan.mode === "hub")
    return (
      <div className={cn("space-y-1 text-sm text-umber-700", className)} data-testid="fulfilment-plan">
        <p className="flex items-center gap-2 font-medium text-umber-900">
          <Warehouse className="size-4 shrink-0 text-gold-700" aria-hidden /> Shipped together from our hub
        </p>
        <p className="pl-6 text-umber-600">
          {plan.parcels.length > 1 ? `${plan.parcels.length} sellers send to our hub; we check everything and ship one box. ` : "Checked at our hub, then shipped. "}
          {plan.dispatch.status === "known" ? (
            <>
              Leaves the hub around <strong className="text-umber-900">{formatDate(plan.dispatch.dispatchAt)}</strong>.
            </>
          ) : (
            "Dispatch date confirmed once every seller's time is known."
          )}
        </p>
      </div>
    );
  return (
    <div className={cn("space-y-1.5 text-sm text-umber-700", className)} data-testid="fulfilment-plan">
      <p className="flex items-center gap-2 font-medium text-umber-900">
        <Package className="size-4 shrink-0 text-gold-700" aria-hidden /> {parcelsHeadline(plan.parcels.length)}
      </p>
      <ul className="space-y-0.5 pl-6 text-umber-600">
        {plan.parcels.map((p) => (
          <li key={p.sellerKey}>
            {p.sellerName}: {p.sellerCity ? `ships from ${p.sellerCity}` : "ships from Pakistan"}
            {p.readyDays != null ? `, leaves in ${days(p.readyDays)}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

type JourneyItem = { id: string; title: string; seller: string; parcelStatus: HubParcelStatus | null; shipmentStatus: "draft" | "booked" | "shipped" | "delivered" | "cancelled" | null };

/** International order: where each item is — with the seller → on the way to our hub → at our hub (checked) → packed → shipped → delivered. */
export function HubJourney({ items, className }: { items: JourneyItem[]; className?: string }) {
  return (
    <ul className={cn("space-y-4", className)} data-testid="hub-journey">
      {items.map((it) => {
        const at = hubItemJourney(it.parcelStatus, it.shipmentStatus);
        return (
          <li key={it.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-umber-900">{it.title}</p>
              <p className="text-xs text-umber-600">
                {at.label}
                {at.detail ? ` · ${at.detail}` : ""}
              </p>
            </div>
            <ol className="mt-2 grid grid-cols-6 gap-1" aria-label={`${it.title}: ${at.label}`}>
              {HUB_JOURNEY.map((s, i) => (
                <li key={s.key} className="min-w-0">
                  <span className={cn("block h-1.5 rounded-full", i <= at.step ? "bg-gold-500" : "bg-umber-200")} />
                  <span className={cn("mt-1 hidden truncate text-[11px] sm:block", i === at.step ? "font-medium text-umber-900" : "text-umber-500")}>
                    {i < at.step ? <Check className="mr-0.5 inline size-3" aria-hidden /> : null}
                    {s.label}
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-1 text-xs text-umber-500">From {it.seller}</p>
          </li>
        );
      })}
    </ul>
  );
}

type Box = { id: string; reference: string; kind: string; status: string; courierName: string | null; trackingNumber: string | null; trackingUrl: string | null; shippedAt: Date | null };

/** The hub's outbound box(es): one tracking number (two for a partial shipment). */
export function HubTracking({ boxes }: { boxes: Box[] }) {
  if (!boxes.length) return null;
  return (
    <div className="space-y-2">
      {boxes.map((b, i) => (
        <p key={b.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-sand-100/70 px-4 py-3 text-sm text-umber-700" data-testid="hub-tracking">
          <Truck className="size-4 text-gold-600" aria-hidden />
          {boxes.length > 1 ? <span className="font-medium text-umber-900">Box {i + 1}</span> : null}
          {b.courierName} · <span className="font-mono text-umber-900">{b.trackingNumber}</span>
          {b.shippedAt ? <span className="text-umber-500">· shipped {formatDate(b.shippedAt)}</span> : null}
          {b.status === "delivered" ? <span className="text-success-700">· delivered</span> : null}
          {b.trackingUrl ? (
            <a href={b.trackingUrl} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 font-medium text-terracotta-600 hover:underline">
              Track <ExternalLink className="size-3.5" aria-hidden />
            </a>
          ) : null}
        </p>
      ))}
    </div>
  );
}

/** Direct parcel: "Ships from Lahore · leaves in 3 days". */
export function ShipsFrom({ city, readyDays, estimate }: { city: string | null; readyDays?: number | null; estimate?: Date | null }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-umber-600">
      <MapPin className="size-3.5" aria-hidden /> Ships from {city ?? "Pakistan"}
      {estimate ? ` · leaves by ${formatDate(estimate)}` : readyDays != null ? ` · leaves in ${days(readyDays)}` : ""}
    </span>
  );
}

/** Extra shipping waiting for the buyer's decision — never charged without approval. */
export function ExtraShippingPanel({ quote, orderNumber, currency }: { quote: { id: string; kind: string; amount: number; note: string | null }; orderNumber: string; currency: Currency }) {
  return (
    <section className="rounded-[var(--radius-card)] bg-gold-50 p-6 ring-1 ring-gold-300" data-testid="extra-shipping">
      <p className="text-xs font-semibold tracking-[0.2em] text-gold-800 uppercase">Your approval needed</p>
      <h2 className="mt-2 font-display text-2xl text-umber-900">Extra shipping: {formatMoney(quote.amount, currency, { cents: true })}</h2>
      <p className="mt-1 text-sm text-umber-700">
        {quote.kind === "partial_shipment" ? "To send the rest of your order in a second box." : "Your packed box came out heavier than estimated."} Nothing is charged unless you approve.
      </p>
      {quote.note ? <p className="mt-2 text-sm text-umber-700">Note from our team: “{quote.note}”</p> : null}
      <div className="mt-4 flex flex-wrap gap-3">
        <form action={approveExtraShipping}>
          <input type="hidden" name="quoteId" value={quote.id} />
          <input type="hidden" name="order" value={orderNumber} />
          <button className="inline-flex h-11 items-center rounded-full bg-umber-900 px-5 text-sm font-semibold text-sand-50">Approve &amp; pay</button>
        </form>
        <form action={declineExtraShipping}>
          <input type="hidden" name="quoteId" value={quote.id} />
          <input type="hidden" name="order" value={orderNumber} />
          <button className="inline-flex h-11 items-center rounded-full px-5 text-sm font-medium text-umber-800 ring-1 ring-umber-300">
            Decline
          </button>
        </form>
      </div>
    </section>
  );
}
