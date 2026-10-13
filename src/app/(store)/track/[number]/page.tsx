import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ExternalLink, Truck } from "lucide-react";
import { isSvg } from "@/components/store/illustration-tag";
import { OrderCostSummary, OrderJourney, OrderStatusBadge } from "@/components/store/order-view";
import { Breadcrumbs, Container } from "@/components/ui/misc";
import { db } from "@/lib/db/client";
import { orders } from "@/lib/db/schema";
import { destinationName, formatMoney, type Currency } from "@/lib/money/currency";
import { canViewOrder } from "@/lib/order-access";
import { formatDate } from "@/lib/utils/format";
import { HubJourney, HubTracking, ShipsFrom } from "@/components/store/fulfilment";
import { getOrderFulfilmentView } from "@/lib/fulfilment/service";
import { parcelsHeadline } from "@/lib/fulfilment/plan";

export const metadata: Metadata = { title: "Order tracking", robots: { index: false } };

const VO_STATUS: Record<string, string> = {
  pending: "Waiting for the artisan",
  accepted: "Accepted by the artisan",
  in_production: "Being made",
  ready_to_ship: "Packed for export",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default async function TrackOrderPage(props: PageProps<"/track/[number]">) {
  const { number } = await props.params;
  const d = await db();
  const order = await d.query.orders.findFirst({
    where: eq(orders.number, number.toUpperCase()),
    with: {
      items: true,
      vendorOrders: { with: { vendor: { columns: { displayName: true, slug: true, workshopCity: true } } } },
    },
  });
  if (!order || !(await canViewOrder(order))) notFound();
  const currency = order.currency as Currency;
  const fv = await getOrderFulfilmentView(order.id);
  const hubMode = fv.fulfilment?.mode === "hub";
  const boxes = fv.shipments.filter((s) => s.kind !== "direct");
  const journeyItems = order.items.map((i) => {
    const parcel = fv.parcels.find((p) => p.vendorOrderId === i.vendorOrderId) ?? null;
    const box = parcel?.shipmentId ? fv.shipments.find((s) => s.id === parcel.shipmentId) : null;
    return { id: i.id, title: i.title, seller: order.vendorOrders.find((v) => v.id === i.vendorOrderId)?.vendor.displayName ?? "", parcelStatus: parcel?.status ?? null, shipmentStatus: box?.status ?? null };
  });

  return (
    <Container className="py-10 md:py-14">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Track an order", href: "/track" }, { label: order.number }]} />
      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-umber-900 md:text-5xl">Order {order.number}</h1>
          <p className="mt-1 text-sm text-umber-500">
            Placed {formatDate(order.createdAt)} · delivering to {destinationName(order.destinationCountry)}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-6">
          <div className="rounded-[var(--radius-card)] bg-white p-6 ring-1 ring-umber-200/70">
            <OrderJourney status={order.status} />
          </div>
          {hubMode ? (
            <section className="space-y-4 rounded-[var(--radius-card)] bg-white p-6 ring-1 ring-umber-200/70">
              <div>
                <h2 className="font-display text-xl text-umber-900">Shipped together from our hub</h2>
                <p className="text-sm text-umber-500">
                  {fv.progress.label}
                  {!boxes.length && fv.fulfilment?.estimatedDispatchAt ? ` · leaves our hub around ${formatDate(fv.fulfilment.estimatedDispatchAt)}` : ""}
                </p>
              </div>
              <HubTracking boxes={boxes} />
              <HubJourney items={journeyItems} />
            </section>
          ) : order.vendorOrders.length > 1 ? (
            <h2 className="font-display text-xl text-umber-900">{parcelsHeadline(order.vendorOrders.length)}</h2>
          ) : null}
          {order.vendorOrders.map((vo) => (
            <section key={vo.id} className="rounded-[var(--radius-card)] bg-white p-6 ring-1 ring-umber-200/70">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-umber-900">
                  From{" "}
                  <Link href={`/artisans/${vo.vendor.slug}`} className="underline-offset-4 hover:underline">
                    {vo.vendor.displayName}
                  </Link>
                </p>
                {hubMode ? null : <ShipsFrom city={vo.vendor.workshopCity} estimate={["shipped", "delivered", "cancelled"].includes(vo.status) ? null : fv.sellerDispatch[vo.id]} />}
                <span className="rounded-full bg-sand-100 px-2.5 py-0.5 text-xs font-medium text-umber-800">{VO_STATUS[vo.status] ?? vo.status}</span>
              </div>
              <ul className="mt-4 divide-y divide-umber-100">
                {order.items
                  .filter((i) => i.vendorOrderId === vo.id)
                  .map((i) => (
                    <li key={i.id} className="flex items-center gap-4 py-3">
                      <span className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-sand-200">
                        {i.imageUrl ? <Image src={i.imageUrl} alt="" fill sizes="56px" unoptimized={isSvg(i.imageUrl)} className="object-cover" /> : null}
                      </span>
                      <span className="min-w-0 flex-1 text-sm">
                        <span className="block truncate font-medium text-umber-900">{i.title}</span>
                        <span className="text-umber-500">Qty {i.qty}</span>
                      </span>
                      <span className="text-sm text-umber-900 tabular-nums">{formatMoney(i.unitPrice * i.qty, currency)}</span>
                    </li>
                  ))}
              </ul>
              {vo.trackingNumber && !hubMode ? (
                <p className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-sand-50 px-4 py-3 text-sm text-umber-700" data-testid="parcel-tracking">
                  <Truck className="size-4 text-umber-500" aria-hidden />
                  {vo.courier ?? "Courier"} · <span className="font-mono">{vo.trackingNumber}</span>
                  {vo.shippedAt ? <span className="text-umber-500">· shipped {formatDate(vo.shippedAt)}</span> : null}
                  {vo.trackingUrl ? (
                    <a href={vo.trackingUrl} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 font-medium text-umber-900 underline-offset-4 hover:underline">
                      Courier tracking <ExternalLink className="size-3.5" aria-hidden />
                    </a>
                  ) : null}
                </p>
              ) : null}
            </section>
          ))}
        </div>
        <aside className="space-y-4">
          <OrderCostSummary order={order} />
          <p className="text-sm text-umber-600">
            Questions? <Link href={`/contact?topic=order&order=${order.number}`} className="underline underline-offset-4">Contact us</Link> — we&apos;ll have your order in front of us.
          </p>
        </aside>
      </div>
    </Container>
  );
}
