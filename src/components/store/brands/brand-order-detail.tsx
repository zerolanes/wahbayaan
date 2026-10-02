import { CreditCard, PackageCheck } from "lucide-react";
import { payOrder } from "@/app/actions/checkout";
import { CancelOrderForm, ConfirmDeliveryForm } from "@/components/store/order-actions";
import { OrderCostSummary, OrderStatusBadge } from "@/components/store/order-view";
import { Breadcrumbs } from "@/components/ui/misc";
import { buildTrackingUrl } from "@/lib/brands/domestic";
import { buyerOrderActions } from "@/lib/commerce/order-view";
import { db } from "@/lib/db/client";
import type { getBuyerOrder } from "@/lib/queries/account";
import { destinationName, formatMoney, type Currency } from "@/lib/money/currency";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import { BrandFulfilmentProgress, BrandOrderItems } from "./brand-order-items";

type Order = NonNullable<Awaited<ReturnType<typeof getBuyerOrder>>>;

const METHOD_LABEL: Record<string, string> = { card: "Card", jazzcash: "JazzCash", easypaisa: "Easypaisa" };

/** Account page for a Pakistani Brands order (catalogue or link request). */
export async function BrandOrderDetail({ order }: { order: Order }) {
  const currency = order.currency as Currency;
  const isRequest = order.brandFlow === "link_request";
  const actions = buyerOrderActions({
    status: order.status,
    paymentStatus: order.paymentStatus,
    totalComplete: order.totalComplete,
    vendorStatuses: order.brandFulfilments.map((f) => (f.status === "dispatched" ? "shipped" : f.status)),
    hasOpenDispute: order.disputes.some((d) => !["resolved", "closed"].includes(d.status)),
  });
  const d = await db();
  const courierRows = await d.query.couriers.findMany({ columns: { name: true, trackingUrlTemplate: true } });
  const trackingLinks = Object.fromEntries(order.brandFulfilments.map((f) => [f.id, buildTrackingUrl(courierRows.find((c) => c.name === f.courier)?.trackingUrlTemplate, f.trackingNumber)]));

  return (
    <div className="space-y-10">
      <div>
        <Breadcrumbs items={[{ label: "Account", href: "/account" }, { label: "Orders", href: "/account/orders" }, { label: order.number }]} />
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl text-umber-900 md:text-5xl">
              {isRequest ? "Request" : "Order"} {order.number}
            </h1>
            <p className="mt-1 text-sm text-umber-500">
              Placed {formatDate(order.createdAt)} · {order.isGift ? "gift delivered within Pakistan" : `delivering to ${destinationName(order.destinationCountry)}`} · Pakistani Brands
            </p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>
      </div>

      {actions.canPay ? (
        <section className="night rounded-[var(--radius-card)] p-6 md:p-8">
          <p className="text-xs font-semibold tracking-[0.2em] text-gold-300 uppercase">{order.status === "quote_sent" ? "Your quote is ready" : "Payment needed"}</p>
          <h2 className="mt-2 font-display text-3xl text-sand-50">Approve {formatMoney(order.total, currency, { cents: true })} and pay</h2>
          <p className="mt-2 max-w-2xl text-sand-200/80">We order from the brand as soon as you&apos;ve paid. Paying with {METHOD_LABEL[order.paymentMethod ?? "card"] ?? "card"}.</p>
          {order.quoteNote ? <p className="mt-3 rounded-xl bg-white/5 px-4 py-3 text-sm text-sand-100 ring-1 ring-white/10">Note from our team: “{order.quoteNote}”</p> : null}
          <form action={payOrder} className="mt-6">
            <input type="hidden" name="order" value={order.number} />
            <button className="inline-flex h-13 items-center gap-2 rounded-full bg-gradient-to-b from-gold-300 to-gold-500 px-7 text-base font-medium text-ink shadow-glow">
              <CreditCard className="size-4" aria-hidden /> Approve &amp; pay
            </button>
          </form>
        </section>
      ) : null}

      {actions.canConfirmDelivery ? (
        <section className="rounded-[var(--radius-card)] bg-success-50 p-6 ring-1 ring-success-600/20 md:p-8">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-success-700 uppercase">
            <PackageCheck className="size-4" aria-hidden /> {order.status === "delivered" ? "Delivered" : "On its way"}
          </p>
          <h2 className="mt-2 font-display text-3xl text-umber-900">Has everything arrived as ordered?</h2>
          <div className="mt-5">
            <ConfirmDeliveryForm orderNumber={order.number} artisans="Wahbayaan" />
          </div>
        </section>
      ) : null}

      <div className="grid gap-10 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="font-display text-2xl text-umber-900">Items</h2>
            <BrandOrderItems items={order.brandItems} currency={order.currency} />
          </section>
          {order.paymentStatus === "paid" ? (
            <section className="space-y-3">
              <h2 className="font-display text-2xl text-umber-900">Progress</h2>
              <BrandFulfilmentProgress fulfilments={order.brandFulfilments} trackingLinks={trackingLinks} />
            </section>
          ) : null}
          <section>
            <h2 className="font-display text-2xl text-umber-900">Updates</h2>
            <ol className="mt-4 space-y-3 border-l border-umber-200 pl-5">
              {[...order.events]
                .filter((e) => e.visibleToBuyer)
                .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
                .map((e) => (
                  <li key={e.id} className="text-sm">
                    <p className="text-umber-900">{e.message}</p>
                    <p className="text-xs text-umber-500">{formatDateTime(e.createdAt)}</p>
                  </li>
                ))}
            </ol>
          </section>
        </div>
        <aside className="space-y-5">
          {order.totalComplete || !isRequest ? <OrderCostSummary order={order} title="Your total" /> : <p className="rounded-2xl bg-pending-50 p-4 text-sm text-umber-800 ring-1 ring-pending-600/20">Your quote is being prepared — items, delivery and our service fee will be itemised here.</p>}
          {actions.canCancel ? <CancelOrderForm orderNumber={order.number} paid={order.paymentStatus === "paid"} /> : null}
        </aside>
      </div>
    </div>
  );
}
