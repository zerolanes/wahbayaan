import Link from "next/link";
import { asc, eq, inArray } from "drizzle-orm";
import { AlertTriangle, Package } from "lucide-react";
import { QuoteForm } from "@/components/admin/quote-form";
import { DemoBadge, OrderAmount, PendingBadge } from "@/components/admin/ui";
import { SellerPrice } from "@/components/money/seller-price";
import { Badge, Card, EmptyState, Notice, PageHeader, Tabs } from "@/components/ui/misc";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { orders } from "@/lib/db/schema";
import { parcelsForOrder, rateTableEstimate } from "@/lib/admin/orders";
import { minorToInput } from "@/lib/admin/money";
import { str } from "@/lib/admin/params";
import { destinationName } from "@/lib/money/currency";
import { formatDims, timeAgo } from "@/lib/utils/format";

export const metadata = { title: "Quotes to send" };

export default async function QuotesPage(props: PageProps<"/admin/quotes">) {
  await requireStaff("orders.manage");
  const params = await props.searchParams;
  const tab = str(params, "tab") === "sent" ? "sent" : "awaiting";
  const d = await db();
  const [awaiting, sent] = await Promise.all([
    d.select().from(orders).where(eq(orders.status, "awaiting_quote")).orderBy(asc(orders.createdAt)),
    d.select().from(orders).where(inArray(orders.status, ["quote_sent", "awaiting_payment"])).orderBy(asc(orders.createdAt)),
  ]);
  const list = tab === "sent" ? sent : awaiting;
  const detail = await Promise.all(list.map(async (o) => ({ order: o, parcels: await parcelsForOrder(o.id), estimate: await rateTableEstimate(o.id) })));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Orders & money"
        title="Quotes to send"
        description="Orders whose shipping or import costs couldn't be priced from the rate tables. Weigh each parcel, confirm with the courier and customs broker, then send the buyer their final total. Nothing is charged until they pay."
      />
      <Tabs
        items={[
          { label: "Awaiting quote", href: "/admin/quotes", active: tab === "awaiting", count: awaiting.length },
          { label: "Sent, awaiting payment", href: "/admin/quotes?tab=sent", active: tab === "sent", count: sent.length },
        ]}
      />
      {detail.length === 0 ? (
        <EmptyState title={tab === "sent" ? "No quotes waiting on buyers" : "No orders waiting for a quote"}>
          {tab === "sent" ? "Every sent quote has been paid or closed." : "New orders that need a manual shipping/duty quote will appear here, oldest first."}
        </EmptyState>
      ) : null}
      {detail.map(({ order: o, parcels, estimate }) => {
        const est = (key: string) => estimate?.lines.find((l) => l.key === key);
        const ageH = (Date.now() - +o.createdAt) / 3_600_000;
        return (
          <Card key={o.id} className="overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-umber-200/60 px-5 py-4">
              <div>
                <p className="flex items-center gap-2 text-lg font-semibold text-umber-900">
                  <Link href={`/admin/orders/${o.number}`} className="hover:text-terracotta-600">
                    {o.number}
                  </Link>
                  <DemoBadge show={o.isDemo} />
                  {ageH > 24 ? <Badge tone="danger">Waiting {Math.floor(ageH / 24)}d</Badge> : <Badge tone="neutral">{timeAgo(o.createdAt)}</Badge>}
                </p>
                <p className="text-sm text-umber-600">
                  {o.customerName} · to {destinationName(o.destinationCountry)} · priced in {o.currency} · items <OrderAmount amount={o.itemsSubtotal} currency={o.currency} />
                  {o.giftWrap ? " · gift-wrapped" : ""}
                </p>
              </div>
              <Link href={`/admin/orders/${o.number}`} className="text-sm text-terracotta-600 hover:underline">
                Full order →
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-0 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
              <div className="space-y-4 border-umber-200/60 p-5 lg:border-r">
                {parcels.map((p, idx) => (
                  <div key={p.id} className="rounded-xl border border-umber-200 bg-white/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="flex items-center gap-2 font-medium text-umber-900">
                        <Package className="size-4 text-umber-400" /> Parcel {idx + 1}: {p.vendor.displayName}
                      </p>
                      <p className="text-sm text-umber-600">
                        from {p.vendor.workshopCity ?? "—"}, Pakistan · {p.weightG ? <strong>{(p.weightG / 1000).toFixed(2)} kg</strong> : <PendingBadge>Weight unknown</PendingBadge>}
                      </p>
                    </div>
                    <ul className="mt-2 space-y-1 text-sm">
                      {p.items.map((i) => {
                        const dims = formatDims(i.product?.widthCm, i.product?.heightCm, i.product?.depthCm);
                        return (
                          <li key={i.id} className="flex flex-wrap justify-between gap-x-4 text-umber-700">
                            <span>
                              {i.qty} × {i.title}
                            </span>
                            <span className="text-umber-500">
                              {i.product?.weightG ? `${(i.product.weightG / 1000).toFixed(2)} kg` : <span className="text-danger-700">no weight</span>} ·{" "}
                              {dims ? dims.cm : <span className="text-danger-700">no dimensions</span>} · <SellerPrice pkr={i.unitPricePkr} />
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    {p.missingWeight.length || p.missingDims.length ? (
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-danger-700">
                        <AlertTriangle className="size-3.5" /> Ask the artisan to weigh and measure the packed parcel before quoting.
                      </p>
                    ) : null}
                  </div>
                ))}
                <div className="rounded-xl bg-sand-100/70 p-4 text-sm">
                  <p className="font-medium text-umber-800">What the rate tables say today</p>
                  <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1">
                    {["shipping", "duty", "import_tax", "handling"].map((k) => {
                      const l = est(k);
                      return (
                        <div key={k} className="flex justify-between gap-2">
                          <dt className="text-umber-600">{l?.label ?? k}</dt>
                          <dd>{!l ? "—" : l.status === "pending" ? <PendingBadge /> : l.status === "not_applicable" ? <span className="text-umber-400">N/A</span> : <OrderAmount amount={l.amount} currency={o.currency} />}</dd>
                        </div>
                      );
                    })}
                  </dl>
                  {estimate?.pendingLines.length ? (
                    <p className="mt-2 text-xs text-umber-500">{estimate.pendingLines.map((l) => l.note).filter(Boolean).join(" · ")}</p>
                  ) : null}
                </div>
                {o.quoteNote && tab === "sent" ? (
                  <Notice tone="indigo" title="Quote sent">
                    {o.quoteSentAt ? `${timeAgo(o.quoteSentAt)} · ` : ""}“{o.quoteNote}”
                  </Notice>
                ) : null}
              </div>
              <div className="p-5">
                <p className="mb-3 text-sm font-medium text-umber-800">{tab === "sent" ? "Revise the quote" : "Quote"}</p>
                <QuoteForm
                  orderId={o.id}
                  currency={o.currency}
                  itemsSubtotal={o.itemsSubtotal}
                  giftWrap={o.giftWrapAmount ?? 0}
                  discount={o.discountAmount}
                  initial={
                    o.shippingStatus === "known"
                      ? {
                          shipping: minorToInput(o.shippingAmount),
                          duty: minorToInput(o.dutyAmount),
                          importTax: minorToInput(o.importTaxAmount),
                          importTaxNa: o.importTaxStatus === "not_applicable",
                          handling: minorToInput(o.handlingAmount),
                          handlingNone: o.handlingStatus === "not_applicable",
                          note: o.quoteNote ?? "",
                        }
                      : {
                          shipping: est("shipping")?.status === "known" ? minorToInput(est("shipping")!.amount) : "",
                          duty: est("duty")?.status === "known" ? minorToInput(est("duty")!.amount) : "",
                        }
                  }
                />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
