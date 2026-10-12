import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Gift, MapPin, Package } from "lucide-react";
import { SellerPrice } from "@/components/money/seller-price";
import { OrderActions } from "@/components/seller/order-actions";
import { BookCourierForm, HandOverForm, SendToHubForm } from "@/components/seller/fulfilment";
import { bookingCouriers, hubAddressIsPlaceholder, sellerFulfilment } from "@/lib/fulfilment/service";
import { getSetting } from "@/lib/settings";
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
  const ff = await sellerFulfilment(order.id, vo.id);
  const hubMode = ff.mode === "hub" && !!ff.parcel;
  const domestic = order.destinationCountry === "PK";
  const live = paid && !["cancelled", "refunded"].includes(order.status) && order.status !== "disputed" && !["shipped", "delivered", "cancelled"].includes(vo.status);
  const domesticCouriers = hubMode || domestic ? await bookingCouriers("PK") : { names: [], bookable: [] };
  const dropOff = hubMode ? (await getSetting("fulfilment")).dropOffInstructions : null;
  const HUB_STATUS: Record<string, string> = {
    expected: "Waiting for you to send it",
    in_transit: "On its way to the hub",
    received: "Received at the hub — being checked",
    qc_passed: "Checked at the hub",
    qc_failed: "The hub found a problem — we'll contact you",
    packed: "Packed for export",
    shipped: "Shipped to the buyer",
    returned_to_seller: "Sent back to you",
    cancelled: "Cancelled",
  };

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
              <OrderActions
                vendorOrderId={vo.id}
                status={vo.status}
                orderPaid={paid && !["cancelled", "refunded"].includes(order.status)}
                disputed={order.status === "disputed"}
                couriers={await getShippingCouriers(order.destinationCountry)}
                hideShipForm={hubMode || domestic}
              />
              {live && !hubMode && domestic ? (
                <div className="mt-5 space-y-4">
                  {ff.shipment?.status === "booked" ? (
                    <div className="space-y-3 rounded-2xl bg-sand-100/70 p-4 text-sm">
                      <p className="font-medium text-umber-900">2. Print the label, 3. hand it over</p>
                      <p className="text-umber-700">
                        {ff.shipment.courierName} · <span className="font-mono">{ff.shipment.trackingNumber}</span>
                      </p>
                      <a href={`/labels/${ff.shipment.reference}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-full border border-umber-300 px-4 font-medium text-umber-900">
                        Print label
                      </a>
                      <HandOverForm shipmentId={ff.shipment.id} />
                    </div>
                  ) : domesticCouriers.names.length ? (
                    <BookCourierForm vendorOrderId={vo.id} couriers={domesticCouriers.names} bookable={domesticCouriers.bookable} />
                  ) : (
                    <p className="text-sm text-umber-600">No domestic courier is set up yet — our team will arrange the pickup.</p>
                  )}
                </div>
              ) : null}
            </div>
          </Card>

          {hubMode && ff.parcel ? (
            <Card>
              <CardHeader title="Send to our hub" description="This order is checked and packed with the buyer's other pieces at our hub, then exported in one box." />
              <div className="space-y-4 p-5 text-sm">
                <div className="rounded-xl bg-sand-100/70 p-3">
                  <p className="text-xs font-semibold tracking-wider text-umber-500 uppercase">Hub address</p>
                  <p className="mt-1 text-umber-900">
                    Wahbayaan — {ff.parcel.hub.name}
                    <br />
                    {ff.parcel.hub.address.line1}
                    {ff.parcel.hub.address.line2 ? `, ${ff.parcel.hub.address.line2}` : ""}
                    <br />
                    {[ff.parcel.hub.city, ff.parcel.hub.address.postalCode].filter(Boolean).join(" ")}
                    {ff.parcel.hub.contactPhone ? (
                      <>
                        <br />
                        Tel {ff.parcel.hub.contactPhone}
                      </>
                    ) : null}
                  </p>
                  {hubAddressIsPlaceholder(ff.parcel.hub) ? <p className="mt-1 text-xs text-pending-600">Full address to be confirmed by Wahbayaan.</p> : null}
                  {ff.parcel.hub.receivingHours ? <p className="mt-1 text-xs text-umber-600">Receiving: {ff.parcel.hub.receivingHours}{ff.parcel.hub.cutoffTime ? ` · cut-off ${ff.parcel.hub.cutoffTime}` : ""}</p> : null}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Parcel reference <span className="font-mono font-semibold text-umber-900">{ff.parcel.reference}</span>
                  </span>
                  <a href={`/labels/${ff.parcel.reference}`} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-full border border-umber-300 px-4 font-medium text-umber-900">
                    Print hub label
                  </a>
                </div>
                <p className="flex items-center gap-2">
                  <Badge tone={ff.parcel.status === "qc_failed" ? "danger" : ["received", "qc_passed", "packed", "shipped"].includes(ff.parcel.status) ? "success" : "neutral"}>{HUB_STATUS[ff.parcel.status] ?? ff.parcel.status}</Badge>
                  {ff.parcel.trackingNumber ? (
                    <span className="text-umber-600">
                      {ff.parcel.courier} · <span className="font-mono">{ff.parcel.trackingNumber}</span>
                    </span>
                  ) : null}
                </p>
                {ff.parcel.status === "qc_failed" && ff.parcel.qcNotes ? <Notice tone="danger">{ff.parcel.qcNotes}</Notice> : null}
                <ul className="list-disc space-y-1 pl-5 text-umber-700">
                  <li>Write the parcel reference on the box and stick the label on top.</li>
                  <li>Don&apos;t include prices or the buyer&apos;s address — the hub repacks for export.</li>
                  {dropOff ? <li>{dropOff}</li> : null}
                </ul>
                {live && ff.parcel.status === "expected" ? <SendToHubForm vendorOrderId={vo.id} couriers={domesticCouriers.names} bookable={domesticCouriers.bookable} /> : null}
              </div>
            </Card>
          ) : null}

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
              {paid && hubMode ? (
                <p className="text-umber-700">Our hub ships it to the buyer in {destinationName(order.destinationCountry)} — send your parcel to the hub (see above).</p>
              ) : paid ? (
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
