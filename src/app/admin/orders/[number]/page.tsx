import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq, inArray } from "drizzle-orm";
import { FileText, Gift, Package, Truck } from "lucide-react";
import {
  cancelOrderAction,
  freezeFundsAction,
  recordPaymentAction,
  refundAction,
  releaseFundsAction,
  resendEmailAction,
  shipVendorOrderAction,
  timelineUpdateAction,
  updateAddressAction,
  updateGiftAction,
  vendorOrderStatusAction,
} from "@/app/actions/admin/orders";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { SelectInput, TextArea, TextInput, Toggle } from "@/components/admin/controls";
import { AuditTrail, NotesPanel } from "@/components/admin/notes-panel";
import { QuoteForm } from "@/components/admin/quote-form";
import { BrandOrderAdmin } from "@/components/admin/brands/brand-order-admin";
import { getShippingCouriers } from "@/lib/couriers";
import { DemoBadge, DetailGrid, KV, OrderAmount, Panel, PendingBadge, StatusBadge, Thumb } from "@/components/admin/ui";
import { SellerPrice } from "@/components/money/seller-price";
import { Badge, Breadcrumbs, Notice, PageHeader } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { certificates, orderEvents, orders, users } from "@/lib/db/schema";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/lib/commerce/orders";
import { minorToInput, orderMoney } from "@/lib/admin/money";
import { DISPUTE_REASON_LABEL } from "@/lib/admin/labels";
import { destinationName } from "@/lib/money/currency";
import { formatDate, formatDateTime, timeAgo } from "@/lib/utils/format";

export async function generateMetadata(props: PageProps<"/admin/orders/[number]">) {
  const { number } = await props.params;
  return { title: `Order ${number}` };
}

const NEXT_STEPS: Record<string, { type: string; label: string }[]> = {
  pending: [
    { type: "accept", label: "Accept" },
    { type: "start_production", label: "Start production" },
  ],
  accepted: [
    { type: "start_production", label: "Start production" },
    { type: "ready", label: "Ready to ship" },
  ],
  in_production: [{ type: "ready", label: "Ready to ship" }],
  ready_to_ship: [],
  shipped: [{ type: "delivered", label: "Mark delivered" }],
};

export default async function OrderDetailPage(props: PageProps<"/admin/orders/[number]">) {
  const user = await requireStaff("orders.view");
  const { number } = await props.params;
  const d = await db();
  const order = await d.query.orders.findFirst({
    where: eq(orders.number, decodeURIComponent(number)),
    with: {
      items: true,
      vendorOrders: { with: { vendor: true } },
      events: { orderBy: asc(orderEvents.createdAt) },
      payments: true,
      refunds: true,
      disputes: true,
      user: true,
    },
  });
  if (!order) notFound();
  if (order.kind === "brand") return <BrandOrderAdmin number={order.number} user={user} />;
  const actorIds = [...new Set(order.events.map((e) => e.actorUserId).filter((x): x is string => !!x))];
  const actors = actorIds.length ? await d.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, actorIds)) : [];
  const certIds = order.items.map((i) => i.certificateId).filter((x): x is string => !!x);
  const certs = certIds.length ? await d.select().from(certificates).where(inArray(certificates.id, certIds)) : [];
  const can = (p: string) => user.permissions.has(p);
  const cur = order.currency;
  const refunded = order.refunds.filter((r) => r.status === "processed").reduce((a, r) => a + r.amount, 0);
  const refundable = order.paymentStatus === "paid" || order.paymentStatus === "partially_refunded" ? order.total - refunded : 0;
  const shippedAny = order.vendorOrders.some((v) => v.status === "shipped" || v.status === "delivered");
  const quoteable = ["awaiting_quote", "quote_sent", "awaiting_payment"].includes(order.status);
  const listed = await getShippingCouriers(order.destinationCountry);
  const courierNames = listed.length ? [...listed, "Other"] : ["DHL Express", "FedEx International Priority", "Aramex", "TCS", "Leopards", "Pakistan Post (EMS)", "Other"];
  const openDispute = order.disputes.find((x) => !["resolved", "closed"].includes(x.status));
  const addr = order.shippingAddress;

  const lines: { label: string; status: string; amount: number | null }[] = [
    { label: "Items", status: "known", amount: order.itemsSubtotal },
    { label: "International shipping", status: order.shippingStatus, amount: order.shippingAmount },
    { label: "Import duty", status: order.dutyStatus, amount: order.dutyAmount },
    { label: "Import tax", status: order.importTaxStatus, amount: order.importTaxAmount },
    { label: "Wahbayaan handling", status: order.handlingStatus, amount: order.handlingAmount },
    ...(order.giftWrap ? [{ label: "Gift wrap", status: order.giftWrapAmount == null ? "pending" : "known", amount: order.giftWrapAmount }] : []),
    ...(order.discountAmount ? [{ label: `Discount${order.couponCode ? ` (${order.couponCode})` : ""}`, status: "known", amount: -order.discountAmount }] : []),
  ];

  const main = (
    <>
      {openDispute ? (
        <Notice tone="danger" title={`Case ${openDispute.number} is open — funds are frozen`}>
          {DISPUTE_REASON_LABEL[openDispute.reason]}: {openDispute.description}{" "}
          <Link href={`/admin/disputes/${openDispute.number}`} className="font-medium underline">
            Open the case →
          </Link>
        </Notice>
      ) : null}
      {!order.totalComplete ? (
        <Notice tone="pending" title="Some cost lines are still pending">
          The buyer hasn&apos;t been charged. Send a quote with the confirmed shipping and import costs — they approve it by paying.
        </Notice>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Buyer">
          <KV
            items={[
              ["Name", order.userId ? <Link href={`/admin/customers/${order.userId}`} className="text-indigo-800 hover:underline">{order.customerName}</Link> : order.customerName],
              ["Email", <a key="e" href={`mailto:${order.email}`} className="text-indigo-800 hover:underline">{order.email}</a>],
              ["Account", order.user ? (order.user.isWholesale ? "Wholesale buyer" : "Registered buyer") : "Guest checkout"],
              ["Destination", destinationName(order.destinationCountry)],
              ["Currency", `${cur} · FX ${Number(order.fxPkrPerUnit)} PKR/unit`],
              ["FX source", <span key="fx" className="text-xs">{order.fxSource} {/placeholder/i.test(order.fxSource) ? <PendingBadge>Placeholder</PendingBadge> : null}</span>],
              ...(order.referralCode ? ([["Referral", order.referralCode]] as [string, string][]) : []),
            ]}
          />
          {order.buyerNotes ? <p className="mt-3 rounded-xl bg-sand-100 px-3 py-2 text-sm text-umber-700">“{order.buyerNotes}”</p> : null}
        </Panel>
        <Panel title="Ship to" action={order.isGift ? <Badge tone="terracotta"><Gift className="size-3" />Gift</Badge> : null}>
          <address className="text-sm leading-relaxed text-umber-800 not-italic">
            {addr.fullName}
            <br />
            {addr.line1}
            {addr.line2 ? (
              <>
                <br />
                {addr.line2}
              </>
            ) : null}
            <br />
            {[addr.city, addr.region, addr.postalCode].filter(Boolean).join(", ")}
            <br />
            {destinationName(addr.country)}
            {addr.phone ? (
              <>
                <br />☎ {addr.phone}
              </>
            ) : null}
          </address>
          {order.isGift ? (
            <div className="mt-3 rounded-xl bg-terracotta-50 px-3 py-2 text-sm text-terracotta-800">
              <p className="text-xs font-semibold tracking-wide uppercase">Gift {order.giftWrap ? "· gift-wrapped" : ""}</p>
              {order.giftMessage ? <p className="mt-1">“{order.giftMessage}”</p> : <p className="mt-1 text-terracotta-600">No gift message</p>}
            </div>
          ) : null}
          {can("orders.manage") ? (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-terracotta-600">Edit address or gift details</summary>
              <ActionForm action={updateAddressAction} inline className="mt-3 grid gap-2 sm:grid-cols-2">
                <input type="hidden" name="orderId" value={order.id} />
                <TextInput name="fullName" defaultValue={addr.fullName} aria-label="Full name" required />
                <TextInput name="phone" defaultValue={addr.phone ?? ""} placeholder="Phone" aria-label="Phone" />
                <TextInput name="line1" defaultValue={addr.line1} aria-label="Address line 1" className="sm:col-span-2" required />
                <TextInput name="line2" defaultValue={addr.line2 ?? ""} placeholder="Line 2" aria-label="Address line 2" className="sm:col-span-2" />
                <TextInput name="city" defaultValue={addr.city} aria-label="City" required />
                <TextInput name="region" defaultValue={addr.region ?? ""} placeholder="State / region" aria-label="Region" />
                <TextInput name="postalCode" defaultValue={addr.postalCode ?? ""} placeholder="Postal code" aria-label="Postal code" />
                <p className="self-center text-xs text-umber-500">Country is fixed ({addr.country}) — duties were priced for it.</p>
                <div className="sm:col-span-2">
                  <SubmitButton disabled={shippedAny}>Save address</SubmitButton>
                </div>
              </ActionForm>
              <ActionForm action={updateGiftAction} inline className="mt-4 space-y-2 border-t border-umber-200 pt-3">
                <input type="hidden" name="orderId" value={order.id} />
                <Toggle name="isGift" label="This order is a gift" defaultChecked={order.isGift} />
                <TextArea name="giftMessage" defaultValue={order.giftMessage ?? ""} rows={2} className="min-h-16" placeholder="Gift message printed on the card" aria-label="Gift message" />
                <SubmitButton>Save gift details</SubmitButton>
              </ActionForm>
            </details>
          ) : null}
        </Panel>
      </div>

      <Panel title={`Parcels (${order.vendorOrders.length})`} description="Each artisan ships separately from their workshop. Artisan amounts in PKR." bodyClassName="p-0">
        <div className="divide-y divide-umber-200/60">
          {order.vendorOrders.map((vo) => {
            const items = order.items.filter((i) => i.vendorOrderId === vo.id);
            const steps = NEXT_STEPS[vo.status] ?? [];
            const paidState = ["paid", "in_fulfilment", "shipped", "delivered"].includes(order.status);
            return (
              <section key={vo.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-2 font-medium text-umber-900">
                      <Package className="size-4 text-umber-400" />
                      <Link href={`/admin/artisans/${vo.vendorId}`} className="hover:text-terracotta-600">
                        {vo.vendor.displayName}
                      </Link>
                      <StatusBadge kind="vendorOrder" status={vo.status} />
                    </p>
                    <p className="mt-0.5 text-sm text-umber-500">
                      {[vo.vendor.workshopCity, "Pakistan"].filter(Boolean).join(", ")} · subtotal <SellerPrice pkr={vo.subtotalPkr} /> · commission{" "}
                      {vo.commissionBps == null ? <PendingBadge>Pending</PendingBadge> : `${vo.commissionBps / 100}%`} · net {vo.netPkr == null ? "—" : <SellerPrice pkr={vo.netPkr} />}
                      {vo.payoutId ? (
                        <>
                          {" "}
                          · <Link href="/admin/payouts" className="text-indigo-800 hover:underline">payout created</Link>
                        </>
                      ) : null}
                    </p>
                    {vo.trackingNumber ? (
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-umber-700">
                        <Truck className="size-3.5" /> {vo.courier} ·{" "}
                        {vo.trackingUrl ? (
                          <a href={vo.trackingUrl} target="_blank" rel="noreferrer" className="text-indigo-800 underline">
                            {vo.trackingNumber}
                          </a>
                        ) : (
                          <code>{vo.trackingNumber}</code>
                        )}
                        {vo.packageWeightG ? ` · ${(vo.packageWeightG / 1000).toFixed(2)} kg` : ""} · shipped {formatDate(vo.shippedAt)}
                        {vo.deliveredAt ? ` · delivered ${formatDate(vo.deliveredAt)}` : ""}
                      </p>
                    ) : null}
                  </div>
                  {can("orders.manage") && paidState ? (
                    <div className="flex flex-wrap gap-2">
                      {steps.map((s) => (
                        <ActionButton key={s.type} action={vendorOrderStatusAction} fields={{ vendorOrderId: vo.id, type: s.type }} confirm={`${s.label} on behalf of ${vo.vendor.displayName}?`}>
                          {s.label}
                        </ActionButton>
                      ))}
                    </div>
                  ) : null}
                </div>
                <Table className="mt-3">
                  <THead>
                    <tr>
                      <Th>Item</Th>
                      <Th>HS code</Th>
                      <Th className="text-right">Qty</Th>
                      <Th className="text-right">Unit ({cur})</Th>
                      <Th className="text-right">Unit (PKR)</Th>
                    </tr>
                  </THead>
                  <TBody>
                    {items.map((i) => {
                      const cert = certs.find((c) => c.id === i.certificateId);
                      const custom = Object.entries(i.customization ?? {});
                      return (
                        <Tr key={i.id}>
                          <Td>
                            <div className="flex items-center gap-3">
                              <Thumb src={i.imageUrl} alt={i.title} kind={i.imageUrl?.startsWith("/art/") ? "illustration" : "photo"} />
                              <div>
                                {i.productId ? (
                                  <Link href={`/admin/listings/${i.productId}`} className="text-umber-900 hover:text-terracotta-600">
                                    {i.title}
                                  </Link>
                                ) : (
                                  i.title
                                )}
                                {custom.length ? <p className="text-xs text-umber-500">{custom.map(([k, v]) => `${k}: ${v}`).join(" · ")}</p> : null}
                                {cert ? (
                                  <Link href={`/admin/certificates?q=${cert.code}`} className="text-xs text-gold-700 hover:underline">
                                    Certificate {cert.code} {cert.status === "void" ? "(void)" : ""}
                                  </Link>
                                ) : null}
                              </div>
                            </div>
                          </Td>
                          <Td>{i.hsCode ? <code className="text-xs">{i.hsCode}</code> : <PendingBadge>Missing</PendingBadge>}</Td>
                          <Td className="text-right tabular-nums">{i.qty}</Td>
                          <Td className="text-right whitespace-nowrap">
                            <OrderAmount amount={i.unitPrice} currency={cur} />
                          </Td>
                          <Td className="text-right whitespace-nowrap">
                            <SellerPrice pkr={i.unitPricePkr} />
                          </Td>
                        </Tr>
                      );
                    })}
                  </TBody>
                </Table>
                {can("orders.manage") && paidState && !["shipped", "delivered", "cancelled"].includes(vo.status) ? (
                  <details className="mt-3 rounded-xl border border-umber-200 bg-white/50 px-4 py-3 text-sm">
                    <summary className="cursor-pointer font-medium text-umber-800">Ship this parcel (add tracking)</summary>
                    <ActionForm action={shipVendorOrderAction} inline className="mt-3 grid gap-2 sm:grid-cols-4">
                      <input type="hidden" name="vendorOrderId" value={vo.id} />
                      <SelectInput name="courier" aria-label="Courier" defaultValue={courierNames[0]}>
                        {courierNames.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </SelectInput>
                      <TextInput name="trackingNumber" placeholder="Tracking number" aria-label="Tracking number" required />
                      <TextInput name="trackingUrl" placeholder="Tracking URL (auto from courier template)" aria-label="Tracking URL" />
                      <TextInput name="packageWeightG" placeholder="Weight (g)" inputMode="numeric" aria-label="Package weight in grams" />
                      <div className="sm:col-span-4">
                        <SubmitButton variant="primary">Mark shipped &amp; notify buyer</SubmitButton>
                      </div>
                    </ActionForm>
                  </details>
                ) : null}
              </section>
            );
          })}
        </div>
      </Panel>

      <Panel title="Landed cost" description={`Buyer-side amounts in ${cur}`} action={<Link href={`/admin/orders/${order.number}/invoice`} className="flex items-center gap-1.5 text-sm text-terracotta-600 hover:underline"><FileText className="size-4" />Commercial invoice</Link>}>
        <dl className="space-y-2 text-sm">
          {lines.map((l) => (
            <div key={l.label} className="flex items-center justify-between gap-4">
              <dt className="text-umber-600">{l.label}</dt>
              <dd>
                {l.status === "pending" ? (
                  <PendingBadge>Pending</PendingBadge>
                ) : l.status === "not_applicable" ? (
                  <span className="text-umber-400">Not applicable</span>
                ) : (
                  <OrderAmount amount={l.amount} currency={cur} />
                )}
              </dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-4 border-t border-umber-200 pt-2 text-base">
            <dt className="font-semibold text-umber-900">{order.totalComplete ? "Total" : "Known so far"}</dt>
            <dd className="font-semibold">
              <OrderAmount amount={order.total} currency={cur} />
            </dd>
          </div>
          {refunded ? (
            <div className="flex items-center justify-between gap-4 text-danger-700">
              <dt>Refunded</dt>
              <dd>
                −<OrderAmount amount={refunded} currency={cur} />
              </dd>
            </div>
          ) : null}
          <p className="text-xs text-umber-500">
            ≈ <SellerPrice pkr={Math.round(order.total * Number(order.fxPkrPerUnit))} /> at the order&apos;s recorded rate.
            {order.quoteSentAt ? ` Quote sent ${formatDateTime(order.quoteSentAt)}.` : ""}
            {order.quoteNote ? ` Quote note: “${order.quoteNote}”` : ""}
          </p>
        </dl>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Payments" bodyClassName="p-0">
          {order.payments.length ? (
            <Table>
              <THead>
                <tr>
                  <Th>Provider</Th>
                  <Th>Amount</Th>
                  <Th>Status</Th>
                  <Th>When</Th>
                </tr>
              </THead>
              <TBody>
                {order.payments.map((p) => (
                  <Tr key={p.id}>
                    <Td>
                      <p>{p.provider}</p>
                      <p className="flex items-center gap-1 text-xs text-umber-500">
                        <Badge tone={p.mode === "live" ? "success" : p.mode === "test" ? "pending" : "neutral"} className="py-0 text-[10px]">
                          {p.mode === "test" ? "Test — no money moved" : p.mode}
                        </Badge>
                        <code className="truncate">{p.providerRef}</code>
                      </p>
                    </Td>
                    <Td className="whitespace-nowrap">
                      <OrderAmount amount={p.amount} currency={p.currency} />
                    </Td>
                    <Td>
                      <StatusBadge kind="paymentRecord" status={p.status} />
                    </Td>
                    <Td className="text-xs whitespace-nowrap text-umber-500">{formatDateTime(p.createdAt)}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          ) : (
            <p className="px-5 py-6 text-sm text-umber-500">No payment attempts yet.</p>
          )}
        </Panel>
        <Panel title="Refunds & disputes" bodyClassName="p-0">
          {order.refunds.length || order.disputes.length ? (
            <ul className="divide-y divide-umber-200/60 text-sm">
              {order.refunds.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                  <span>
                    Refund <OrderAmount amount={r.amount} currency={r.currency} /> <span className="text-umber-500">— {r.reason}</span>
                  </span>
                  <StatusBadge kind="refund" status={r.status} />
                </li>
              ))}
              {order.disputes.map((x) => (
                <li key={x.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                  <Link href={`/admin/disputes/${x.number}`} className="text-indigo-800 hover:underline">
                    {x.number} · {DISPUTE_REASON_LABEL[x.reason]}
                  </Link>
                  <StatusBadge kind="dispute" status={x.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-sm text-umber-500">No refunds or cases.</p>
          )}
        </Panel>
      </div>

      <Panel title="Timeline" description="Events marked “internal” are hidden from the buyer.">
        <ol className="relative space-y-4 border-l border-umber-200 pl-5">
          {order.events.map((e) => (
            <li key={e.id} className="text-sm">
              <span className={`absolute -left-[6px] mt-1 size-3 rounded-full border-2 border-sand-50 ${e.kind.includes("dispute") ? "bg-danger-600" : e.kind === "paid" || e.kind === "released" ? "bg-success-600" : "bg-gold-500"}`} />
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-umber-900">{e.message}</p>
                {!e.visibleToBuyer ? <Badge tone="neutral" className="text-[10px]">Internal</Badge> : null}
              </div>
              <p className="text-xs text-umber-500">
                <code>{e.kind}</code> · {formatDateTime(e.createdAt)} ({timeAgo(e.createdAt)}){e.actorUserId ? ` · ${actors.find((a) => a.id === e.actorUserId)?.name ?? "user"}` : ""}
              </p>
            </li>
          ))}
        </ol>
        {can("orders.manage") ? (
          <ActionForm action={timelineUpdateAction} resetOnSuccess className="mt-5 space-y-2 border-t border-umber-200 pt-4">
            <input type="hidden" name="orderId" value={order.id} />
            <TextArea name="message" rows={2} className="min-h-16" placeholder="Post an update, e.g. “Cleared Karachi export customs”" aria-label="Timeline update" required />
            <div className="flex items-center justify-between gap-3">
              <Toggle name="visibleToBuyer" label="Visible to the buyer" defaultChecked />
              <SubmitButton>Add to timeline</SubmitButton>
            </div>
          </ActionForm>
        ) : null}
      </Panel>
    </>
  );

  const side = (
    <>
      <Panel title="Status">
        <KV
          items={[
            ["Order", <Badge key="s" tone={ORDER_STATUS_TONE[order.status] ?? "neutral"}>{ORDER_STATUS_LABEL[order.status] ?? order.status}</Badge>],
            ["Payment", <StatusBadge key="p" kind="payment" status={order.paymentStatus} />],
            ["Funds", <StatusBadge key="f" kind="funds" status={order.fundsState} />],
            ["Placed", formatDateTime(order.createdAt)],
            ["Paid", order.paidAt ? formatDateTime(order.paidAt) : "—"],
            ["Delivered", order.deliveredAt ? formatDateTime(order.deliveredAt) : "—"],
            ["Auto-release", order.autoReleaseAt ? `${formatDateTime(order.autoReleaseAt)}${order.autoReleaseAt < new Date() && order.fundsState === "held" ? " (due)" : ""}` : "—"],
            ["Released", order.releasedAt ? formatDateTime(order.releasedAt) : "—"],
            ...(order.cancelledAt ? ([["Cancelled", formatDateTime(order.cancelledAt)]] as [string, string][]) : []),
          ]}
        />
      </Panel>

      {quoteable && can("orders.manage") ? (
        <Panel title={order.status === "awaiting_quote" ? "Send quote" : "Revise quote"} description={`Amounts in ${cur}. The buyer approves by paying.`}>
          <QuoteForm
            orderId={order.id}
            currency={cur}
            itemsSubtotal={order.itemsSubtotal}
            giftWrap={order.giftWrapAmount ?? 0}
            discount={order.discountAmount}
            initial={
              order.shippingStatus === "known"
                ? {
                    shipping: minorToInput(order.shippingAmount),
                    duty: minorToInput(order.dutyAmount),
                    importTax: minorToInput(order.importTaxAmount),
                    importTaxNa: order.importTaxStatus === "not_applicable",
                    handling: minorToInput(order.handlingAmount),
                    handlingNone: order.handlingStatus === "not_applicable",
                    note: order.quoteNote ?? "",
                  }
                : undefined
            }
          />
        </Panel>
      ) : null}

      {can("orders.manage") && order.totalComplete && ["quote_sent", "awaiting_payment"].includes(order.status) ? (
        <Panel title="Record a manual payment" description="For a bank transfer or payment taken outside checkout. Funds become held.">
          <ActionForm action={recordPaymentAction} inline className="space-y-2">
            <input type="hidden" name="orderId" value={order.id} />
            <SelectInput name="method" aria-label="Method">
              <option>Bank transfer</option>
              <option>Wise</option>
              <option>PayPal invoice</option>
              <option>Other</option>
            </SelectInput>
            <TextInput name="reference" placeholder="Transfer reference" aria-label="Reference" required />
            <SubmitButton confirm={`Confirm you received ${orderMoney(order.total, cur)}?`}>Mark paid · {orderMoney(order.total, cur)}</SubmitButton>
          </ActionForm>
        </Panel>
      ) : null}

      {can("escrow.release") && (order.fundsState === "held" || order.fundsState === "frozen") ? (
        <Panel title="Escrow" description={order.fundsState === "frozen" ? "Funds are frozen — auto-release is paused." : "Buyer funds are held by Wahbayaan."}>
          {order.fundsState === "held" ? (
            <ActionForm action={releaseFundsAction} inline className="space-y-2">
              <input type="hidden" name="orderId" value={order.id} />
              <TextInput name="reason" placeholder="Reason, e.g. buyer confirmed by email" aria-label="Reason" required />
              <SubmitButton variant="primary" confirm="Release the held funds to the artisans now? This completes the order.">
                Release funds
              </SubmitButton>
            </ActionForm>
          ) : null}
          <ActionForm action={freezeFundsAction} inline className="mt-3 space-y-2 border-t border-umber-200 pt-3">
            <input type="hidden" name="orderId" value={order.id} />
            <input type="hidden" name="op" value={order.fundsState === "held" ? "freeze" : "unfreeze"} />
            <TextInput name="reason" placeholder={order.fundsState === "held" ? "Why freeze?" : "Why unfreeze?"} aria-label="Reason" required />
            <SubmitButton variant="outline">{order.fundsState === "held" ? "Freeze funds" : "Unfreeze funds"}</SubmitButton>
          </ActionForm>
        </Panel>
      ) : null}

      {can("orders.refund") && refundable > 0 ? (
        <Panel title="Refund" description={`Up to ${orderMoney(refundable, cur)} can be refunded to the original payment method.`}>
          <ActionForm action={refundAction} inline className="space-y-2">
            <input type="hidden" name="orderId" value={order.id} />
            <SelectInput name="mode" aria-label="Refund type" defaultValue="partial">
              <option value="partial">Partial refund</option>
              <option value="full">Full refund ({orderMoney(refundable, cur)})</option>
            </SelectInput>
            <TextInput name="amount" placeholder={`Amount in ${cur} (partial only)`} inputMode="decimal" aria-label="Amount" />
            <TextInput name="reason" placeholder="Reason (shown to the buyer)" aria-label="Reason" required />
            <SubmitButton variant="danger" confirm="Issue this refund now? It can't be undone.">
              Issue refund
            </SubmitButton>
          </ActionForm>
        </Panel>
      ) : null}

      {can("orders.manage") ? (
        <Panel title="Communicate">
          <ActionForm action={resendEmailAction} inline className="space-y-2">
            <input type="hidden" name="orderId" value={order.id} />
            <SelectInput name="template" aria-label="Email" defaultValue="status">
              <option value="status">Status update</option>
              <option value="quote" disabled={!order.totalComplete}>
                Resend quote / total
              </option>
              <option value="custom">Custom message</option>
            </SelectInput>
            <TextInput name="subject" placeholder="Subject (custom only)" aria-label="Subject" />
            <TextArea name="message" rows={3} placeholder="Message (custom only)" aria-label="Message" className="min-h-16" />
            <SubmitButton>Send email to {order.email}</SubmitButton>
          </ActionForm>
        </Panel>
      ) : null}

      {can("orders.manage") && !["cancelled", "refunded", "completed"].includes(order.status) && !shippedAny ? (
        <Panel title="Cancel order" description={order.paymentStatus === "paid" ? "The buyer is refunded in full and stock is restored." : "Stock is restored."}>
          <ActionForm action={cancelOrderAction} inline className="space-y-2">
            <input type="hidden" name="orderId" value={order.id} />
            <TextInput name="reason" placeholder="Reason" aria-label="Reason" required />
            <SubmitButton variant="danger" confirm="Cancel this order?">
              Cancel order
            </SubmitButton>
          </ActionForm>
        </Panel>
      ) : null}

      <NotesPanel entity="order" entityId={order.id} currentUserId={user.id} />
      <AuditTrail entity="order" entityId={order.id} />
    </>
  );

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Orders", href: "/admin/orders" }, { label: order.number }]} />
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {order.number}
            <Badge tone={ORDER_STATUS_TONE[order.status] ?? "neutral"} className="font-sans text-sm">
              {ORDER_STATUS_LABEL[order.status] ?? order.status}
            </Badge>
            <DemoBadge show={order.isDemo} />
          </span>
        }
        description={`Placed ${formatDateTime(order.createdAt)} by ${order.customerName} · ${destinationName(order.destinationCountry)} · ${orderMoney(order.total, cur)}`}
        actions={
          <Link href={`/admin/orders/${order.number}/invoice`} className="inline-flex h-9 items-center gap-2 rounded-full border border-umber-300/70 px-4 text-sm hover:border-umber-900">
            <FileText className="size-4" /> Commercial invoice
          </Link>
        }
      />
      <DetailGrid main={main} side={side} />
    </div>
  );
}
