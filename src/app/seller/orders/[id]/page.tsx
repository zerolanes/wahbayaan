import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Gift, MapPin, Package } from "lucide-react";
import { SellerPrice } from "@/components/money/seller-price";
import { OrderActions } from "@/components/seller/order-actions";
import { FUNDS_LABEL, VendorOrderBadge } from "@/components/seller/status";
import { Badge, Breadcrumbs, Card, CardHeader, Notice, PageHeader } from "@/components/ui/misc";
import { requireSeller } from "@/lib/auth/session";
import { getShippingCouriers } from "@/lib/couriers";
import { getSellerOrder } from "@/lib/seller/queries";
import { destinationName } from "@/lib/money/currency";
import { formatDateTime, formatWeight } from "@/lib/utils/format";

export const metadata = { title: "Order" };

const PACKING = [
  "Wrap the piece in acid-free tissue, then bubble wrap — at least two layers on corners and edges.",
  "Use a double-walled box with 5 cm of padding on every side; frames go corner-protected.",
  "Put the printed Wahbayaan packing slip and the care card inside the box.",
  "Photograph the piece and the sealed box before handing it over — it protects you if there's a claim.",
  "Weigh the sealed parcel and enter the weight with the tracking number.",
];

export default async function SellerOrder(props: PageProps<"/seller/orders/[id]">) {
  const user = await requireSeller();
  const { id } = await props.params;
  const data = await getSellerOrder(user.vendorId, id);
  if (!data) notFound();
  const { vo, events, payout } = data;
  const order = vo.order;
  const paid = order.paymentStatus === "paid" || order.paymentStatus === "partially_refunded";
  const addr = order.shippingAddress;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Orders", href: "/seller/orders" }, { label: order.number }]} />
      <PageHeader
        eyebrow={`Ship to ${destinationName(order.destinationCountry)}`}
        title={`Order ${order.number}`}
        description={`Placed ${formatDateTime(order.createdAt)}`}
        actions={<VendorOrderBadge status={vo.status} />}
      />
      {order.status === "disputed" ? (
        <Notice tone="danger" title="The buyer opened a case">
          Our team is reviewing it and may message you. Held funds are frozen until it&apos;s resolved.
        </Notice>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Pieces in this parcel" />
            <ul className="divide-umber-200/60 divide-y">
              {vo.items.map((item) => (
                <li key={item.id} className="flex gap-4 p-5">
                  <div className="bg-sand-200 relative size-20 shrink-0 overflow-hidden rounded-xl">
                    {item.imageUrl ? (
                      <Image src={item.imageUrl} alt="" fill sizes="80px" unoptimized={item.imageUrl.endsWith(".svg")} className="object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-umber-900 font-medium">{item.title}</p>
                    <p className="text-umber-500 text-sm">
                      Qty {item.qty} · <SellerPrice pkr={item.unitPricePkr} /> each
                      {item.product?.weightG ? ` · ${formatWeight(item.product.weightG)?.metric} listed weight` : ""}
                    </p>
                    {Object.keys(item.customization).length ? (
                      <div className="bg-gold-50 ring-gold-200 mt-2 rounded-xl p-3 text-sm ring-1">
                        <p className="text-gold-800 text-xs font-semibold tracking-wider uppercase">Buyer&apos;s customisation</p>
                        <dl className="mt-1 space-y-0.5">
                          {Object.entries(item.customization).map(([k, v]) => (
                            <div key={k} className="flex gap-2">
                              <dt className="text-umber-500">{item.product?.customizationOptions.find((o) => o.id === k)?.label ?? k}:</dt>
                              <dd className="text-umber-900 font-medium">{v}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Export packing checklist" description="Most transit damage is preventable. Pack for a long journey and several handovers." />
            <ul className="space-y-2.5 p-5">
              {PACKING.map((p) => (
                <li key={p} className="text-umber-700 flex gap-2.5 text-sm">
                  <CheckCircle2 className="text-turquoise-600 mt-0.5 size-4 shrink-0" />
                  {p}
                </li>
              ))}
            </ul>
            <p className="text-umber-500 px-5 pb-5 text-xs">
              The commercial invoice for customs is prepared by Wahbayaan from this order — you don&apos;t need to fill it in.{" "}
              <Link href="/seller/guide" className="underline">
                Export guide
              </Link>
            </p>
          </Card>

          <Card>
            <CardHeader title="Timeline" />
            <ol className="space-y-4 p-5">
              {events.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className="bg-gold-500 mt-1.5 size-2 shrink-0 rounded-full" />
                  <div>
                    <p className="text-umber-800 text-sm">{e.message}</p>
                    <p className="text-umber-500 text-xs">{formatDateTime(e.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Next step" />
            <div className="p-5">
              <OrderActions vendorOrderId={vo.id} status={vo.status} orderPaid={paid && !["cancelled", "refunded"].includes(order.status)} disputed={order.status === "disputed"} couriers={await getShippingCouriers(order.destinationCountry)} />
            </div>
          </Card>

          <Card>
            <CardHeader title="Your earnings" description="In Pakistani rupees" />
            <dl className="space-y-2 p-5 text-sm">
              <div className="flex justify-between">
                <dt className="text-umber-600">Your pieces</dt>
                <dd>
                  <SellerPrice pkr={vo.subtotalPkr} />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-umber-600">Wahbayaan commission</dt>
                <dd>
                  {vo.commissionPkr != null ? (
                    <>
                      − <SellerPrice pkr={vo.commissionPkr} />
                    </>
                  ) : (
                    <Badge tone="pending">Rate pending</Badge>
                  )}
                </dd>
              </div>
              <div className="border-umber-200 flex justify-between border-t pt-2 font-semibold">
                <dt>You receive</dt>
                <dd>{vo.netPkr != null ? <SellerPrice pkr={vo.netPkr} /> : <span className="text-umber-500 font-normal">Confirmed at release</span>}</dd>
              </div>
              <div className="flex justify-between pt-2 text-xs">
                <dt className="text-umber-500">Buyer&apos;s payment</dt>
                <dd className="text-umber-700">{FUNDS_LABEL[order.fundsState]}</dd>
              </div>
              {payout ? (
                <div className="flex justify-between text-xs">
                  <dt className="text-umber-500">Payout</dt>
                  <dd className="text-umber-700 capitalize">{payout.status.replace("_", " ")}</dd>
                </div>
              ) : null}
            </dl>
            <p className="text-umber-500 px-5 pb-5 text-xs">
              Shipping, import duty and taxes are paid by the buyer separately and never come out of your earnings.
            </p>
          </Card>

          <Card>
            <CardHeader title="Delivery" />
            <div className="space-y-3 p-5 text-sm">
              {paid ? (
                <p className="text-umber-700 flex gap-2">
                  <MapPin className="text-gold-600 mt-0.5 size-4 shrink-0" />
                  <span>
                    {addr.fullName}
                    <br />
                    {addr.line1}
                    {addr.line2 ? `, ${addr.line2}` : ""}
                    <br />
                    {addr.city}
                    {addr.region ? `, ${addr.region}` : ""} {addr.postalCode}
                    <br />
                    {destinationName(addr.country)}
                  </span>
                </p>
              ) : (
                <p className="text-umber-500">The delivery address is shown once the buyer has paid.</p>
              )}
              {order.isGift ? (
                <p className="bg-terracotta-50 text-terracotta-800 flex gap-2 rounded-xl p-3">
                  <Gift className="mt-0.5 size-4 shrink-0" />
                  <span>
                    This is a gift{order.giftWrap ? " — please gift-wrap it" : ""}. Don&apos;t include prices in the parcel.
                    {order.giftMessage ? (
                      <>
                        <br />
                        <em>“{order.giftMessage}”</em> — print this on the card.
                      </>
                    ) : null}
                  </span>
                </p>
              ) : null}
              {vo.trackingNumber ? (
                <p className="text-umber-700 flex gap-2">
                  <Package className="text-gold-600 mt-0.5 size-4 shrink-0" />
                  {vo.courier} · {vo.trackingNumber}
                </p>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
