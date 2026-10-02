import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, CreditCard, ExternalLink, Gift, LifeBuoy, PackageCheck, Star, Truck, XCircle } from "lucide-react";
import { BrandOrderDetail } from "@/components/store/brands/brand-order-detail";
import { isSvg } from "@/components/store/illustration-tag";
import { CancelOrderForm, ConfirmDeliveryForm, OpenCaseForm } from "@/components/store/order-actions";
import { OrderCostSummary, OrderJourney, OrderStatusBadge } from "@/components/store/order-view";
import { Badge, Breadcrumbs } from "@/components/ui/misc";
import { requireUser } from "@/lib/auth/session";
import { buyerOrderActions, DISPUTE_STATUS_LABEL } from "@/lib/commerce/order-view";
import { destinationName, formatMoney, type Currency } from "@/lib/money/currency";
import { activeProvider } from "@/lib/payments";
import { getBuyerOrder } from "@/lib/queries/account";
import { getSetting } from "@/lib/settings";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import { payOrder } from "@/app/actions/checkout";

export async function generateMetadata(props: PageProps<"/account/orders/[number]">): Promise<Metadata> {
  const { number } = await props.params;
  return { title: `Order ${number}`, robots: { index: false } };
}

const VO_STATUS: Record<string, string> = {
  pending: "Waiting for the artisan",
  accepted: "Accepted by the artisan",
  in_production: "Being made",
  ready_to_ship: "Packed for export",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default async function OrderDetailPage(props: PageProps<"/account/orders/[number]">) {
  const { number } = await props.params;
  const user = await requireUser(`/account/orders/${number}`);
  const order = await getBuyerOrder(user.id, number);
  if (!order) notFound();
  if (order.kind === "brand") return <BrandOrderDetail order={order} />;
  const escrow = await getSetting("escrow");
  const currency = order.currency as Currency;
  const openDispute = order.disputes.find((d) => !["resolved", "closed"].includes(d.status));
  const actions = buyerOrderActions({
    status: order.status,
    paymentStatus: order.paymentStatus,
    totalComplete: order.totalComplete,
    vendorStatuses: order.vendorOrders.map((v) => v.status),
    hasOpenDispute: !!openDispute,
  });
  const artisans = order.vendorOrders.map((v) => v.vendor.displayName).join(" and ");
  const provider = activeProvider();
  const reviewable = ["delivered", "completed"].includes(order.status);

  return (
    <div className="space-y-10">
      <div>
        <Breadcrumbs items={[{ label: "Account", href: "/account" }, { label: "Orders", href: "/account/orders" }, { label: order.number }]} />
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl text-umber-900 md:text-5xl">Order {order.number}</h1>
            <p className="mt-1 text-sm text-umber-500">
              Placed {formatDate(order.createdAt)} · shipping to {destinationName(order.destinationCountry)}
            </p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>
      </div>

      {/* Action panel */}
      {actions.canPay ? (
        <section className="night rounded-[var(--radius-card)] p-6 md:p-8">
          <p className="text-xs font-semibold tracking-[0.2em] text-gold-300 uppercase">{order.status === "quote_sent" ? "Your quote is ready" : "Payment needed"}</p>
          <h2 className="mt-2 font-display text-3xl text-sand-50">Approve {formatMoney(order.total, currency, { cents: true })} and pay</h2>
          <p className="mt-2 max-w-2xl text-sand-200/80">
            {order.status === "quote_sent"
              ? "Our team has confirmed every cost for your country (see the breakdown below). Approving starts your order; your payment is held until your piece arrives."
              : "Your total is complete. Pay to start your order — your payment is held until your piece arrives."}
          </p>
          {order.quoteNote ? <p className="mt-3 rounded-xl bg-white/5 px-4 py-3 text-sm text-sand-100 ring-1 ring-white/10">Note from our team: “{order.quoteNote}”</p> : null}
          <form action={payOrder} className="mt-6 flex flex-wrap items-center gap-4">
            <input type="hidden" name="order" value={order.number} />
            <button className="inline-flex h-13 items-center gap-2 rounded-full bg-gradient-to-b from-gold-300 to-gold-500 px-7 text-base font-medium text-ink shadow-glow">
              <CreditCard className="size-4" aria-hidden /> Approve &amp; pay
            </button>
            <span className={provider.id === "test" ? "rounded-full bg-pending-50 px-3 py-1 text-xs font-medium text-pending-600" : "text-xs text-sand-200/60"}>{provider.label}</span>
          </form>
        </section>
      ) : null}

      {actions.canConfirmDelivery ? (
        <section className="rounded-[var(--radius-card)] bg-success-50 p-6 ring-1 ring-success-600/20 md:p-8">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-success-700 uppercase">
            <PackageCheck className="size-4" aria-hidden /> {order.status === "delivered" ? "Delivered" : "On its way"}
          </p>
          <h2 className="mt-2 font-display text-3xl text-umber-900">Has everything arrived as described?</h2>
          <p className="mt-2 max-w-2xl text-umber-700">
            Your payment has been held by Wahbayaan the whole way. Confirming releases it to {artisans}.
            {order.autoReleaseAt
              ? ` If you don't confirm or open a case, it's released automatically on ${formatDate(order.autoReleaseAt)}.`
              : escrow.status === "active"
                ? ` If you don't confirm or open a case, it's released automatically ${escrow.autoReleaseDaysAfterDelivery} days after delivery.`
                : ""}{" "}
            Something wrong? Open a case instead — don&apos;t confirm.
          </p>
          <div className="mt-5">
            <ConfirmDeliveryForm orderNumber={order.number} artisans={artisans} />
          </div>
        </section>
      ) : null}

      {openDispute ? (
        <Link href={`/account/disputes/${openDispute.number}`} className="flex items-center justify-between gap-4 rounded-2xl bg-danger-50 p-5 ring-1 ring-danger-600/20">
          <span className="flex items-center gap-3 text-danger-700">
            <LifeBuoy className="size-5" aria-hidden />
            <span>
              <span className="font-semibold">Case {openDispute.number}</span> — {DISPUTE_STATUS_LABEL[openDispute.status]}. Held funds are frozen while we resolve it.
            </span>
          </span>
          <span className="text-sm font-semibold text-danger-700">View case →</span>
        </Link>
      ) : null}

      <div className="grid gap-10 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="space-y-10">
          {/* Parcels */}
          <section>
            <h2 className="font-display text-2xl text-umber-900">{order.vendorOrders.length > 1 ? `${order.vendorOrders.length} parcels` : "Your parcel"}</h2>
            <p className="mt-1 text-sm text-umber-500">Each artisan ships separately from their workshop.</p>
            <div className="mt-4 space-y-4">
              {order.vendorOrders.map((vo) => {
                const items = order.items.filter((i) => i.vendorOrderId === vo.id);
                return (
                  <article key={vo.id} className="overflow-hidden rounded-2xl bg-sand-50 ring-1 ring-umber-200/60">
                    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-umber-200/60 bg-sand-100/60 px-5 py-3">
                      <Link href={`/artisans/${vo.vendor.slug}`} className="flex items-center gap-3">
                        <span className="relative size-8 overflow-hidden rounded-full bg-sand-200">
                          {vo.vendor.profilePhotoUrl ? <Image src={vo.vendor.profilePhotoUrl} alt="" fill sizes="32px" unoptimized={isSvg(vo.vendor.profilePhotoUrl)} className="object-cover" /> : null}
                        </span>
                        <span className="text-sm font-semibold text-umber-900">{vo.vendor.displayName}</span>
                      </Link>
                      <Badge tone={vo.status === "shipped" || vo.status === "delivered" ? "turquoise" : vo.status === "cancelled" ? "neutral" : "indigo"}>{VO_STATUS[vo.status] ?? vo.status}</Badge>
                    </header>
                    {vo.trackingNumber ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-umber-200/60 px-5 py-3 text-sm">
                        <span className="flex items-center gap-2 text-umber-700">
                          <Truck className="size-4 text-gold-600" aria-hidden />
                          {vo.courier} · <span className="font-mono text-umber-900">{vo.trackingNumber}</span>
                          {vo.shippedAt ? <span className="text-umber-500">· shipped {formatDate(vo.shippedAt)}</span> : null}
                        </span>
                        {vo.trackingUrl ? (
                          <a href={vo.trackingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-terracotta-600 hover:underline">
                            Track parcel <ExternalLink className="size-3.5" aria-hidden />
                          </a>
                        ) : null}
                      </div>
                    ) : null}
                    <ul className="divide-y divide-umber-200/60">
                      {items.map((i) => {
                        const cert = i.certificateId ? order.certificateCodes.get(i.certificateId) : null;
                        const canReview = reviewable && i.product && i.product.status === "active" && i.productId && !order.reviewedProductIds.has(i.productId);
                        return (
                          <li key={i.id} className="flex gap-4 p-5">
                            <span className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-sand-200">
                              {i.imageUrl ? <Image src={i.imageUrl} alt="" fill sizes="80px" unoptimized={isSvg(i.imageUrl)} className="object-cover" /> : null}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <p className="font-display text-lg text-umber-900">
                                  {i.product && i.product.status === "active" ? (
                                    <Link href={`/product/${i.product.slug}`} className="hover:text-terracotta-700">
                                      {i.title}
                                    </Link>
                                  ) : (
                                    i.title
                                  )}
                                </p>
                                <p className="text-sm font-medium text-umber-900 tabular-nums">{formatMoney(i.unitPrice * i.qty, currency, { cents: true })}</p>
                              </div>
                              <p className="text-sm text-umber-500">
                                Qty {i.qty}
                                {Object.entries(i.customization).length ? ` · ${Object.values(i.customization).join(" · ")}` : ""}
                              </p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {cert ? (
                                  <Link href={`/certificate/${cert}`} className="inline-flex items-center gap-1.5 rounded-full bg-gold-100 px-3 py-1 text-xs font-medium text-gold-800 hover:bg-gold-200">
                                    <Award className="size-3.5" aria-hidden /> Certificate {cert}
                                  </Link>
                                ) : null}
                                {canReview ? (
                                  <Link href={`/product/${i.product!.slug}#write-review`} className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-800 hover:bg-indigo-100">
                                    <Star className="size-3.5" aria-hidden /> Review this piece
                                  </Link>
                                ) : null}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </article>
                );
              })}
            </div>
          </section>

          {/* Timeline */}
          <section>
            <h2 className="font-display text-2xl text-umber-900">Timeline</h2>
            <ol className="mt-4 space-y-0 border-l border-umber-200 pl-6">
              {[...order.events].reverse().map((e) => (
                <li key={e.id} className="relative pb-5 last:pb-0">
                  <span aria-hidden className="absolute top-1.5 -left-[29px] size-2.5 rounded-full bg-gold-500 ring-4 ring-parchment" />
                  <p className="text-sm text-umber-900">{e.message}</p>
                  <p className="text-xs text-umber-500">{formatDateTime(e.createdAt)}</p>
                </li>
              ))}
            </ol>
          </section>

          {actions.canOpenCase ? (
            <details className="group rounded-2xl bg-sand-50 ring-1 ring-umber-200/60" id="open-case">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 [&::-webkit-details-marker]:hidden">
                <span>
                  <span className="flex items-center gap-2 font-semibold text-umber-900">
                    <LifeBuoy className="size-5 text-danger-600" aria-hidden /> Something wrong? Open a case
                  </span>
                  <span className="text-sm text-umber-500">Damaged, not as described or never arrived — we&apos;ll freeze the held funds and help.</span>
                </span>
                <span className="text-sm font-medium text-terracotta-600 group-open:hidden">Start</span>
              </summary>
              <div className="border-t border-umber-200/60 p-5">
                <OpenCaseForm orderNumber={order.number} parcels={order.vendorOrders.map((v) => ({ id: v.id, label: `Parcel from ${v.vendor.displayName}` }))} />
              </div>
            </details>
          ) : null}

          {actions.canCancel ? (
            <details className="group rounded-2xl ring-1 ring-umber-200/60">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2 text-sm font-medium text-umber-700">
                  <XCircle className="size-4" aria-hidden /> Cancel this order
                </span>
                <span className="text-xs text-umber-500">Possible until it ships</span>
              </summary>
              <div className="border-t border-umber-200/60 p-5">
                <p className="mb-3 text-sm text-umber-600">
                  {order.paymentStatus === "paid" ? "You'll be refunded in full to your original payment method." : "Nothing has been charged, so there's nothing to refund."}
                </p>
                <CancelOrderForm orderNumber={order.number} paid={order.paymentStatus === "paid"} />
              </div>
            </details>
          ) : null}
        </div>

        <aside className="space-y-5">
          <OrderCostSummary order={order} title={order.paymentStatus === "paid" ? "Landed cost as charged" : order.totalComplete ? "Landed cost" : "Landed cost — known so far"} />
          {order.paymentStatus === "paid" ? (
            <p className="rounded-xl bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
              Funds: <strong>{order.fundsState === "held" ? "held by Wahbayaan" : order.fundsState === "released" ? "released to the artisan" : order.fundsState === "frozen" ? "frozen while your case is reviewed" : order.fundsState}</strong>
            </p>
          ) : null}
          <div className="rounded-2xl bg-sand-50 p-5 ring-1 ring-umber-200/60">
            <p className="mb-4 text-xs font-semibold tracking-wider text-umber-500 uppercase">Journey</p>
            <OrderJourney status={order.status} />
          </div>
          <div className="rounded-2xl bg-sand-50 p-5 text-sm ring-1 ring-umber-200/60">
            <p className="text-xs font-semibold tracking-wider text-umber-500 uppercase">Delivering to</p>
            <p className="mt-2 text-umber-800">
              {order.shippingAddress.fullName}
              <br />
              {order.shippingAddress.line1}
              {order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ""}
              <br />
              {order.shippingAddress.city} {order.shippingAddress.region ?? ""} {order.shippingAddress.postalCode ?? ""}
              <br />
              {destinationName(order.shippingAddress.country)}
            </p>
            {order.isGift ? (
              <p className="mt-4 flex gap-2 border-t border-umber-200/60 pt-4 text-umber-700">
                <Gift className="mt-0.5 size-4 shrink-0 text-terracotta-600" aria-hidden />
                <span>
                  Gift{order.giftWrap ? ", wrapped" : ""}
                  {order.giftMessage ? ` — “${order.giftMessage}”` : ""}
                </span>
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
