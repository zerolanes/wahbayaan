import Link from "next/link";
import { asc, eq, inArray } from "drizzle-orm";
import { ExternalLink } from "lucide-react";
import { brandFulfilmentAction, priceBrandItemsAction, sendBrandQuoteAction } from "@/app/actions/admin/brand-orders";
import { cancelOrderAction, recordPaymentAction, refundAction, releaseFundsAction, timelineUpdateAction } from "@/app/actions/admin/orders";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { SelectInput, TextArea, TextInput, Toggle } from "@/components/admin/controls";
import { AuditTrail, NotesPanel } from "@/components/admin/notes-panel";
import { DemoBadge, DetailGrid, KV, OrderAmount, Panel, StatusBadge } from "@/components/admin/ui";
import { SellerPrice } from "@/components/money/seller-price";
import { Badge, Breadcrumbs, Notice, PageHeader } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import type { CurrentUser } from "@/lib/auth/session";
import { minorToInput, orderMoney } from "@/lib/admin/money";
import { buildTrackingUrl } from "@/lib/brands/domestic";
import { computeOrderQuote, toPkr } from "@/lib/brands/orders";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/lib/commerce/orders";
import { db } from "@/lib/db/client";
import { couriers, orderEvents, orders, users } from "@/lib/db/schema";
import { destinationName, formatMoney, type Currency } from "@/lib/money/currency";
import { formatDateTime } from "@/lib/utils/format";

const STEPS = [
  { key: "ordered_from_brand", label: "Ordered from brand" },
  { key: "received_at_wahbayaan", label: "Received at Wahbayaan" },
  { key: "quality_checked", label: "Quality checked" },
  { key: "dispatched", label: "Dispatched" },
  { key: "delivered", label: "Delivered" },
] as const;

/**
 * Admin view of a Pakistani Brands order: Wahbayaan purchases from the brand on
 * the buyer's behalf. Link-request items are priced here; the quote is computed
 * from the service-fee settings and courier rates; then the fulfilment
 * checklist runs ordered → received → quality checked → dispatched → delivered.
 */
export async function BrandOrderAdmin({ number, user }: { number: string; user: CurrentUser }) {
  const d = await db();
  const order = await d.query.orders.findFirst({
    where: eq(orders.number, number),
    with: { brandItems: true, brandFulfilments: true, events: { orderBy: asc(orderEvents.createdAt) }, payments: true, refunds: true, user: true },
  });
  if (!order) return null;
  const can = (p: string) => user.permissions.has(p);
  const cur = order.currency as Currency;
  const quoteable = ["awaiting_quote", "quote_sent", "awaiting_payment"].includes(order.status);
  const { ready, quote } = quoteable ? await computeOrderQuote(order.id) : { ready: null, quote: null };
  const courierRows = await d.select().from(couriers).orderBy(asc(couriers.name));
  const actorIds = [...new Set(order.events.map((e) => e.actorUserId).filter((x): x is string => !!x))];
  const actors = actorIds.length ? await d.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, actorIds)) : [];
  const refunded = order.refunds.filter((r) => r.status === "processed").reduce((a, r) => a + r.amount, 0);
  const isRequest = order.brandFlow === "link_request";
  const addr = order.shippingAddress;
  const pendingKeys = new Set(quote?.pendingLines.map((l) => l.key) ?? []);
  const itemsPkr = order.brandItems.filter((i) => !i.unavailable).reduce((a, i) => a + (i.unitPricePkr ?? 0) * i.qty, 0);
  const purchaseCost = order.brandFulfilments.reduce((a, f) => a + (f.purchaseCostPkr ?? 0), 0);

  const main = (
    <>
      <Notice tone="indigo" title="Wahbayaan buys from the brand on the buyer's behalf">
        {isRequest ? "Shop-by-link request: check each item at the brand (it may be any brand — we never fetch the link), enter the brand's price and an estimated weight, then send the quote." : "Catalogue order from the brand bag."} Buy from the brand only after the buyer has paid.
      </Notice>

      <Panel title={`Items (${order.brandItems.length})`} description={isRequest ? "Prices in PKR as charged by the brand. Weight drives the shipping quote." : undefined}>
        <ActionForm action={priceBrandItemsAction} className="space-y-4">
          <input type="hidden" name="orderId" value={order.id} />
          <Table>
            <THead>
              <tr>
                <Th>Item</Th>
                <Th>Brand</Th>
                <Th className="w-28">Price (PKR)</Th>
                <Th className="w-24">Weight (g)</Th>
                <Th>Check</Th>
              </tr>
            </THead>
            <TBody>
              {order.brandItems.map((i) => (
                <Tr key={i.id}>
                  <Td>
                    <p className="font-medium text-umber-900">
                      {i.qty} × {i.title}
                    </p>
                    <p className="text-xs text-umber-500">{[i.size && `Size ${i.size}`, i.colour, i.sku].filter(Boolean).join(" · ")}</p>
                    {i.buyerNote ? <p className="text-xs text-umber-600">Buyer: {i.buyerNote}</p> : null}
                    {i.requestedUrl ? (
                      <a href={i.requestedUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-xs text-indigo-800 underline">
                        {i.requestedDomain} <ExternalLink className="size-3" />
                      </a>
                    ) : i.sourceUrl ? (
                      <a href={i.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-indigo-800 underline">
                        On the brand&apos;s site <ExternalLink className="size-3" />
                      </a>
                    ) : null}
                  </Td>
                  <Td className="text-sm">{i.brandName}</Td>
                  <Td>
                    {quoteable ? (
                      <TextInput name={`price_${i.id}`} defaultValue={minorToInput(i.unitPricePkr)} aria-label={`Price of ${i.title} in PKR`} placeholder="3490" />
                    ) : (
                      <SellerPrice pkr={i.unitPricePkr} />
                    )}
                  </Td>
                  <Td>{quoteable ? <TextInput name={`weight_${i.id}`} type="number" defaultValue={i.weightG ?? ""} aria-label={`Weight of ${i.title} in grams`} /> : <span className="text-sm">{i.weightG ?? "—"}</span>}</Td>
                  <Td className="space-y-1">
                    {quoteable ? (
                      <>
                        <Toggle name={`unavailable_${i.id}`} label="Not available" defaultChecked={i.unavailable} />
                        <TextInput name={`note_${i.id}`} defaultValue={i.staffNote ?? ""} placeholder="Note to buyer" aria-label="Note to buyer" />
                      </>
                    ) : i.unavailable ? (
                      <Badge tone="neutral">Not available</Badge>
                    ) : null}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
          {quoteable && can("orders.manage") ? <SubmitButton variant="outline">Save prices &amp; recompute</SubmitButton> : null}
        </ActionForm>
      </Panel>

      {quoteable ? (
        <Panel title="Quote" description="Computed from the service-fee settings and active courier rates. Pending lines stay pending — enter a confirmed amount to send the quote, never a guess.">
          {order.status === "quote_sent" && order.quoteSentAt ? (
            <Notice tone="success" className="mb-4" title={`Quote sent ${formatDateTime(order.quoteSentAt)}: ${orderMoney(order.total, cur)}`}>
              Waiting for the buyer to approve and pay. Sending again replaces it.
            </Notice>
          ) : null}
          {!ready?.ok ? (
            <Notice tone="pending">{ready?.reason}</Notice>
          ) : quote ? (
            <>
              <KV
                items={quote.lines.map((l) => [
                  l.label,
                  l.status === "pending" ? <Badge key={l.key} tone="pending">Pending</Badge> : l.status === "not_applicable" ? "—" : orderMoney(l.amount, cur),
                ])}
              />
              <p className="mt-3 text-sm text-umber-600">
                Known so far: <strong>{orderMoney(quote.knownTotal, cur)}</strong>
                {quote.complete ? " — complete." : ` + ${quote.pendingLines.length} pending.`} Service fee in PKR: {quote.serviceFeePkr != null ? formatMoney(quote.serviceFeePkr, "PKR") : "pending"}.
              </p>
              {can("orders.manage") ? (
                <ActionForm action={sendBrandQuoteAction} className="mt-4 grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="orderId" value={order.id} />
                  {pendingKeys.has("shipping") ? <TextInput name="shipping" placeholder={`Confirmed shipping (${cur})`} aria-label="Confirmed shipping" /> : null}
                  {pendingKeys.has("duty") ? <TextInput name="duty" placeholder={`Confirmed import duty (${cur}, 0 if none)`} aria-label="Confirmed duty" /> : null}
                  {pendingKeys.has("import_tax") ? <TextInput name="importTax" placeholder={`Confirmed import tax (${cur})`} aria-label="Confirmed import tax" /> : null}
                  {pendingKeys.has("service_fee") ? <TextInput name="serviceFee" placeholder={`Service fee (${cur}) — not set in settings`} aria-label="Service fee" /> : null}
                  <TextArea name="note" placeholder="Note to the buyer (optional)" aria-label="Note to the buyer" className="sm:col-span-2" />
                  <div className="sm:col-span-2">
                    <SubmitButton>Send quote to buyer</SubmitButton>
                  </div>
                </ActionForm>
              ) : null}
            </>
          ) : null}
        </Panel>
      ) : null}

      <Panel title="Fulfilment checklist" description="One row per brand. Buyers are notified at each step; dispatching builds the tracking link from the courier's template.">
        {order.paymentStatus !== "paid" ? <Notice tone="pending" className="mb-4">Waiting for payment — don&apos;t buy from the brand yet.</Notice> : null}
        <div className="space-y-4">
          {order.brandFulfilments.map((f) => {
            const reached = STEPS.findIndex((s) => s.key === f.status);
            const next = STEPS[reached + 1];
            const link = buildTrackingUrl(courierRows.find((c) => c.name === f.courier)?.trackingUrlTemplate, f.trackingNumber);
            return (
              <div key={f.id} className="rounded-xl border border-umber-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-umber-900">{f.brandLabel}</p>
                  <StatusBadge kind="brandFulfilment" status={f.status} />
                </div>
                <ol className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                  {STEPS.map((s, i) => (
                    <li key={s.key} className={i <= reached ? "font-medium text-success-700" : "text-umber-400"}>
                      {i <= reached ? "✓" : "○"} {s.label}
                    </li>
                  ))}
                </ol>
                <p className="mt-2 text-xs text-umber-500">
                  {f.brandOrderRef ? `Brand order ref ${f.brandOrderRef} · ` : ""}
                  {f.purchaseCostPkr != null ? `paid Rs ${(f.purchaseCostPkr / 100).toLocaleString("en-PK")} · ` : ""}
                  {f.trackingNumber ? (
                    <>
                      {f.courier} {link ? <a href={link} className="underline" target="_blank" rel="noreferrer">{f.trackingNumber}</a> : f.trackingNumber}
                    </>
                  ) : null}
                </p>
                {next && f.status !== "cancelled" && order.paymentStatus === "paid" && can("orders.manage") ? (
                  <ActionForm action={brandFulfilmentAction} className="mt-3 flex flex-wrap items-end gap-2">
                    <input type="hidden" name="orderId" value={order.id} />
                    <input type="hidden" name="fulfilmentId" value={f.id} />
                    <input type="hidden" name="step" value={next.key} />
                    {next.key === "ordered_from_brand" ? (
                      <>
                        <TextInput name="brandOrderRef" placeholder="Brand order ref" className="w-40" aria-label="Brand order reference" />
                        <TextInput name="purchaseCost" placeholder="Paid to brand (PKR)" className="w-40" aria-label="Purchase cost in PKR" />
                      </>
                    ) : null}
                    {next.key === "quality_checked" ? <TextInput name="notes" placeholder="QC notes" className="w-56" aria-label="QC notes" /> : null}
                    {next.key === "dispatched" ? (
                      <>
                        <SelectInput name="courier" className="w-48" aria-label="Courier" defaultValue="">
                          <option value="" disabled>
                            Courier…
                          </option>
                          {courierRows
                            .filter((c) => (order.destinationCountry === "PK" ? c.domestic : c.international))
                            .map((c) => (
                              <option key={c.id} value={c.name}>
                                {c.name}
                                {c.isActive ? "" : " (inactive)"}
                              </option>
                            ))}
                        </SelectInput>
                        <TextInput name="trackingNumber" placeholder="Tracking number" className="w-40" aria-label="Tracking number" />
                      </>
                    ) : null}
                    <SubmitButton variant="primary">Mark: {next.label}</SubmitButton>
                  </ActionForm>
                ) : null}
              </div>
            );
          })}
        </div>
        {order.brandFulfilments.length > 1 && order.paymentStatus === "paid" && can("orders.manage") ? (
          <ActionForm action={brandFulfilmentAction} className="mt-4 flex flex-wrap items-end gap-2 border-t border-umber-200/60 pt-4">
            <input type="hidden" name="orderId" value={order.id} />
            <input type="hidden" name="fulfilmentId" value="all" />
            <input type="hidden" name="step" value="dispatched" />
            <span className="text-sm text-umber-700">Dispatch the whole box:</span>
            <SelectInput name="courier" className="w-48" aria-label="Courier (whole box)" defaultValue="">
              <option value="" disabled>
                Courier…
              </option>
              {courierRows.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </SelectInput>
            <TextInput name="trackingNumber" placeholder="Tracking number" className="w-40" aria-label="Tracking number (whole box)" />
            <SubmitButton variant="outline">Dispatch all</SubmitButton>
          </ActionForm>
        ) : null}
      </Panel>

      <Panel title="Timeline">
        <ol className="space-y-2 text-sm">
          {order.events.map((e) => (
            <li key={e.id} className="flex gap-3">
              <span className="w-36 shrink-0 text-xs text-umber-500">{formatDateTime(e.createdAt)}</span>
              <span className={e.visibleToBuyer ? "text-umber-900" : "text-umber-500 italic"}>
                {e.message}
                {e.actorUserId ? <span className="text-xs text-umber-400"> — {actors.find((a) => a.id === e.actorUserId)?.name}</span> : null}
              </span>
            </li>
          ))}
        </ol>
        {can("orders.manage") ? (
          <ActionForm action={timelineUpdateAction} resetOnSuccess className="mt-4 flex flex-wrap gap-2">
            <input type="hidden" name="orderId" value={order.id} />
            <TextInput name="message" placeholder="Add an update" className="min-w-64 flex-1" aria-label="Timeline update" />
            <Toggle name="visibleToBuyer" label="Visible to buyer" defaultChecked />
            <SubmitButton variant="outline">Add</SubmitButton>
          </ActionForm>
        ) : null}
      </Panel>
    </>
  );

  const side = (
    <>
      <Panel title="Summary">
        <KV
          items={[
            ["Type", isRequest ? "Shop by link" : "Catalogue"],
            ["Ship to", `${destinationName(order.destinationCountry)}${order.isGift ? " (gift)" : ""}`],
            ["Buyer pays in", cur],
            ["Payment method", order.paymentMethod ?? "card"],
            ["Payment", <StatusBadge key="p" kind="payment" status={order.paymentStatus} />],
            ["Funds", <StatusBadge key="f" kind="funds" status={order.fundsState} />],
            ["Total", order.totalComplete ? <OrderAmount key="t" amount={order.total} currency={order.currency} /> : <Badge key="t" tone="pending">Quote pending</Badge>],
            ["Items at brand prices", <SellerPrice key="i" pkr={itemsPkr || null} />],
            ["Service fee (PKR)", order.serviceFeeAmount != null ? <SellerPrice key="s" pkr={toPkr(order.serviceFeeAmount, order)} /> : "—"],
            ["Paid to brands", <SellerPrice key="c" pkr={purchaseCost || null} />],
          ]}
        />
      </Panel>
      <Panel title={order.isGift ? "Recipient" : "Delivery address"}>
        <p className="text-sm leading-relaxed text-umber-800">
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
              <br />
              {addr.phone}
            </>
          ) : null}
        </p>
        {order.giftMessage ? <p className="mt-2 rounded-lg bg-umber-50 p-2 text-sm">Gift message: “{order.giftMessage}”</p> : null}
        {order.buyerNotes ? <p className="mt-2 text-sm text-umber-600">Buyer notes: {order.buyerNotes}</p> : null}
        <p className="mt-2 text-xs text-umber-500">
          {order.customerName} · {order.email}
          {order.user ? (
            <>
              {" "}
              · <Link href={`/admin/customers/${order.user.id}`} className="underline">customer</Link>
            </>
          ) : null}
        </p>
      </Panel>
      {can("orders.manage") && ["awaiting_payment", "quote_sent"].includes(order.status) ? (
        <Panel title="Record an offline payment">
          <ActionForm action={recordPaymentAction} className="space-y-2">
            <input type="hidden" name="orderId" value={order.id} />
            <TextInput name="method" placeholder="Method (e.g. bank transfer)" aria-label="Method" />
            <TextInput name="reference" placeholder="Reference" aria-label="Reference" />
            <SubmitButton variant="outline">Mark paid</SubmitButton>
          </ActionForm>
        </Panel>
      ) : null}
      {can("escrow.release") && order.fundsState === "held" && ["delivered", "shipped"].includes(order.status) ? (
        <Panel title="Complete order">
          <ActionForm action={releaseFundsAction} className="space-y-2">
            <input type="hidden" name="orderId" value={order.id} />
            <TextInput name="reason" placeholder="Reason" defaultValue="Delivered to the buyer" aria-label="Reason" />
            <SubmitButton variant="outline">Complete &amp; release</SubmitButton>
          </ActionForm>
        </Panel>
      ) : null}
      {can("orders.refund") && order.paymentStatus !== "unpaid" && order.total - refunded > 0 ? (
        <Panel title="Refund">
          <ActionForm action={refundAction} className="space-y-2" confirm="Issue this refund?">
            <input type="hidden" name="orderId" value={order.id} />
            <SelectInput name="mode" defaultValue="full" aria-label="Refund type">
              <option value="full">Full ({orderMoney(order.total - refunded, cur)})</option>
              <option value="partial">Partial</option>
            </SelectInput>
            <TextInput name="amount" placeholder={`Amount (${cur}) for partial`} aria-label="Amount" />
            <TextInput name="reason" placeholder="Reason" aria-label="Reason" />
            <SubmitButton variant="danger">Refund</SubmitButton>
          </ActionForm>
        </Panel>
      ) : null}
      {can("orders.manage") && !["cancelled", "refunded", "completed", "shipped", "delivered"].includes(order.status) ? (
        <Panel title="Cancel">
          <ActionForm action={cancelOrderAction} className="space-y-2" confirm="Cancel this order? Paid orders are refunded.">
            <input type="hidden" name="orderId" value={order.id} />
            <TextInput name="reason" placeholder="Reason" aria-label="Cancellation reason" />
            <SubmitButton variant="danger">Cancel order</SubmitButton>
          </ActionForm>
        </Panel>
      ) : null}
      <NotesPanel entity="order" entityId={order.id} currentUserId={user.id} />
      <AuditTrail entity="order" entityId={order.id} />
    </>
  );

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Brand orders", href: "/admin/brand-requests" }, { label: order.number }]} />
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {order.number}
            <Badge tone={ORDER_STATUS_TONE[order.status] ?? "neutral"} className="font-sans text-sm">
              {ORDER_STATUS_LABEL[order.status] ?? order.status}
            </Badge>
            <Badge tone="gold" className="font-sans text-sm">
              Pakistani Brands · {isRequest ? "shop by link" : "catalogue"}
            </Badge>
            <DemoBadge show={order.isDemo} />
          </span>
        }
        description={`Placed ${formatDateTime(order.createdAt)} by ${order.customerName} · ${destinationName(order.destinationCountry)} · ${order.totalComplete ? orderMoney(order.total, cur) : "quote pending"}`}
      />
      <DetailGrid main={main} side={side} />
    </div>
  );
}
