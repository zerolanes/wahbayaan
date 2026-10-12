import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { extraShippingQuoteAction } from "@/app/actions/admin/fulfilment";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { FieldRow, SelectInput, TextInput } from "@/components/admin/controls";
import { PackForm } from "@/components/admin/pack-form";
import { KV, OrderAmount, Panel, StatusBadge } from "@/components/admin/ui";
import { SellerPrice } from "@/components/money/seller-price";
import { Badge, Breadcrumbs, Notice, PageHeader } from "@/components/ui/misc";
import { requireStaff } from "@/lib/auth/session";
import { getShippingCouriers } from "@/lib/couriers";
import { db } from "@/lib/db/client";
import { orders } from "@/lib/db/schema";
import { orderMoney } from "@/lib/admin/money";
import { finalShippingDelta } from "@/lib/fulfilment/consolidation";
import { courierWithAdapter, getOrderFulfilmentView } from "@/lib/fulfilment/service";
import { convertFromPkr, destinationName, type Currency } from "@/lib/money/currency";
import { getSetting } from "@/lib/settings";
import { formatDate } from "@/lib/utils/format";

export const metadata = { title: "Pack & ship" };

export default async function PackPage(props: PageProps<"/admin/hub/pack/[number]">) {
  await requireStaff("hub.operate");
  const { number } = await props.params;
  const d = await db();
  const order = await d.query.orders.findFirst({ where: eq(orders.number, decodeURIComponent(number)) });
  if (!order) notFound();
  const view = await getOrderFulfilmentView(order.id);
  if (view.fulfilment?.mode !== "hub") notFound();
  const setting = await getSetting("fulfilment");
  const listed = await getShippingCouriers(order.destinationCountry);
  const bookable: string[] = [];
  for (const c of listed) if ((await courierWithAdapter(c)).adapterId !== "manual") bookable.push(c);
  const open = view.parcels.filter((p) => !["shipped", "cancelled", "returned_to_seller"].includes(p.status));
  const boxes = view.shipments.filter((s) => s.kind !== "direct");
  const fx = { currency: order.currency as Currency, pkrPerUnit: Number(order.fxPkrPerUnit), source: order.fxSource, status: "manual" as const };
  const addr = order.shippingAddress;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Hub operations", href: "/admin/hub?tab=consolidation" }, { label: order.number, href: `/admin/orders/${order.number}` }, { label: "Pack & ship" }]} />
      <PageHeader eyebrow={`Hub · ${view.hub?.name ?? ""}`} title={`Pack & ship ${order.number}`} description={`${view.progress.label} · to ${destinationName(order.destinationCountry)}`} />
      {view.fulfilment.decision === "ship_partial" && open.some((p) => p.status !== "qc_passed") ? (
        <Notice tone="gold" title="Partial shipment">
          Only the checked parcels go now; the rest follows in another box. Extra shipping for that box is charged only if the buyer approves it (below).
        </Notice>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          {open.length ? (
            <Panel title="Box">
              <PackForm orderId={order.id} parcels={open} couriers={listed.length ? listed : ["Other"]} divisor={setting.volumetricDivisor} bookable={bookable} />
            </Panel>
          ) : (
            <Notice tone="success" title="Everything has shipped" />
          )}
          {boxes.map((s) => {
            const final = s.rateCostPkr != null ? convertFromPkr(s.rateCostPkr, fx) : null;
            const delta = s.kind === "consolidated" ? finalShippingDelta(order.shippingAmount, final) : null;
            return (
              <Panel key={s.id} title={`${s.reference} · ${s.courierName}`} action={<StatusBadge kind="shipment" status={s.status} />}>
                <KV
                  items={[
                    ["Tracking", <code key="t">{s.trackingNumber}</code>],
                    ["Box", `${s.weightG ? (s.weightG / 1000).toFixed(2) : "—"} kg · ${s.lengthCm}×${s.widthCm}×${s.heightCm} cm`],
                    ["Volumetric / chargeable", `${((s.volumetricWeightG ?? 0) / 1000).toFixed(2)} kg / ${((s.chargeableWeightG ?? 0) / 1000).toFixed(2)} kg`],
                    ["Rate card cost", s.rateCostPkr != null ? <SellerPrice key="r" pkr={s.rateCostPkr} /> : <Badge key="r" tone="pending">Pending — no active rate for this weight</Badge>],
                    ["Shipped", formatDate(s.shippedAt)],
                  ]}
                />
                <p className="mt-3 flex gap-3 text-sm">
                  <a href={`/labels/${s.reference}`} target="_blank" rel="noreferrer" className="text-indigo-800 underline">
                    Print label
                  </a>
                  <Link href={`/admin/orders/${order.number}/invoice?shipment=${s.reference}`} className="text-indigo-800 underline">
                    Commercial invoice & packing list
                  </Link>
                </p>
                {delta?.action === "quote" ? (
                  <Notice tone="gold" className="mt-3" title={`The packed box costs ${orderMoney(delta.difference, order.currency)} more than the buyer paid`}>
                    Ask the buyer to approve the difference below — or absorb it. Nothing is charged without their approval.
                  </Notice>
                ) : null}
              </Panel>
            );
          })}
        </div>
        <aside className="space-y-6">
          <Panel title="Ship to">
            <address className="text-sm leading-relaxed not-italic">
              {addr.fullName}
              <br />
              {addr.line1}
              {addr.line2 ? `, ${addr.line2}` : ""}
              <br />
              {[addr.city, addr.region, addr.postalCode].filter(Boolean).join(", ")}
              <br />
              {destinationName(addr.country)}
            </address>
          </Panel>
          <Panel title="Shipping paid by the buyer">
            <KV
              items={[
                ["Shipping charged", order.shippingStatus === "known" ? <OrderAmount key="s" amount={order.shippingAmount} currency={order.currency} /> : <Badge key="s" tone="pending">Pending</Badge>],
                ["Estimated dispatch", view.fulfilment.estimatedDispatchAt ? formatDate(view.fulfilment.estimatedDispatchAt) : "Pending"],
              ]}
            />
          </Panel>
          <Panel title="Extra shipping (buyer approval)">
            {view.quotes.length ? (
              <ul className="mb-3 space-y-1 text-sm">
                {view.quotes.map((q) => (
                  <li key={q.id} className="flex justify-between gap-2">
                    <span>{orderMoney(q.amount, q.currency)}</span>
                    <StatusBadge kind="fulfilmentQuote" status={q.status} />
                  </li>
                ))}
              </ul>
            ) : null}
            <ActionForm action={extraShippingQuoteAction} inline className="space-y-3">
              <input type="hidden" name="orderId" value={order.id} />
              <FieldRow label="Reason" htmlFor="xq-kind">
                <SelectInput id="xq-kind" name="kind" defaultValue={view.fulfilment.decision === "ship_partial" ? "partial_shipment" : "final_weight"}>
                  <option value="partial_shipment">Second box (partial shipment)</option>
                  <option value="final_weight">Packed box costs more than estimated</option>
                </SelectInput>
              </FieldRow>
              <FieldRow label={`Amount (${order.currency})`} htmlFor="xq-amount">
                <TextInput id="xq-amount" name="amount" inputMode="decimal" required />
              </FieldRow>
              <FieldRow label="Note to the buyer" htmlFor="xq-note">
                <TextInput id="xq-note" name="note" />
              </FieldRow>
              <SubmitButton variant="outline">Ask the buyer to approve</SubmitButton>
            </ActionForm>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
