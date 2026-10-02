import Link from "next/link";
import type { ReactNode } from "react";
import { BarChart, HBarList, ShareBar } from "@/components/admin/charts";
import { DemoBadge, ExportLink, FilterBar, FilterDate, MiniStat, OrderAmount, Panel, PendingBadge } from "@/components/admin/ui";
import { SellerPrice } from "@/components/money/seller-price";
import { Badge, PageHeader } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { getFxTable } from "@/lib/commerce/rates";
import { DISPUTE_REASON_LABEL, humanize } from "@/lib/admin/labels";
import { orderMoney } from "@/lib/admin/money";
import { hrefWith, isoDay } from "@/lib/admin/params";
import { fromPkr } from "@/lib/admin/reports";
import { reportData } from "@/lib/admin/reports-data";
import { CURRENCY_COLORS, percent, ratio, SERIES_COLORS } from "@/lib/admin/series";
import { destinationName, formatMoney } from "@/lib/money/currency";
import { cn } from "@/lib/utils/cn";

export const metadata = { title: "Reports" };

const SECTIONS = [
  { id: "gmv", label: "GMV by month" },
  { id: "destinations", label: "Destinations" },
  { id: "categories", label: "Categories" },
  { id: "artisans", label: "Artisans" },
  { id: "landed", label: "Landed cost" },
  { id: "refunds", label: "Refunds & disputes" },
  { id: "payouts", label: "Payouts" },
];

function Section({ id, title, description, exportHref, children }: { id: string; title: string; description: ReactNode; exportHref: string; children: ReactNode }) {
  return (
    <section id={id} className="min-w-0 scroll-mt-24">
      <Panel title={title} description={description} action={<ExportLink href={exportHref}>CSV</ExportLink>}>
        {children}
      </Panel>
    </section>
  );
}

export default async function ReportsPage(props: PageProps<"/admin/reports">) {
  await requireStaff("reports.view");
  const params = await props.searchParams;
  const [data, fx] = await Promise.all([reportData(params), getFxTable()]);
  const r = data.range;
  const exp = (report: string) => `/admin/export/reports?report=${report}&from=${r.fromStr}&to=${r.toStr}`;
  const usd = fx.USD;
  const today = new Date();
  const presets = [
    { label: "30 days", from: new Date(today.getTime() - 29 * 86_400_000) },
    { label: "90 days", from: new Date(today.getTime() - 89 * 86_400_000) },
    { label: "12 months", from: new Date(today.getTime() - 364 * 86_400_000) },
    { label: "Year to date", from: new Date(Date.UTC(today.getUTCFullYear(), 0, 1)) },
  ].map((p) => ({ ...p, href: hrefWith("/admin/reports", params, { from: isoDay(p.from), to: isoDay(today) }) }));
  const currencies = [...new Set(data.months.flatMap((m) => Object.keys(m.byCurrency)))].sort();
  const aovPkr = data.valuePaid.length ? Math.round(data.gmvPkr / data.valuePaid.length) : null;
  const catTotal = data.categories.reduce((a, c) => a + c.pkr, 0);
  const artTotal = data.artisans.reduce((a, c) => a + c.gross, 0);
  const destTotal = data.destinations.reduce((a, d) => a + d.pkr, 0);
  const payoutPaid = data.payouts.reduce((a, p) => a + p.paidInRange, 0);
  const payoutOpen = data.payouts.filter((p) => ["pending", "scheduled", "on_hold"].includes(p.status)).reduce((a, p) => a + p.pkr, 0);
  const refundsProcessed = data.refunds.filter((x) => x.status === "processed");
  const openDisputes = data.disputes.filter((x) => !["resolved", "closed"].includes(x.status)).reduce((a, x) => a + x.n, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Insights"
        title="Reports"
        description="Marketplace performance for a date range. Buyer amounts stay in their own currency; cross-currency totals are in PKR at each order's recorded rate. Pending cost lines are counted, never averaged as zero."
      />
      <div className="flex flex-wrap items-center gap-3">
        <FilterBar action="/admin/reports">
          <FilterDate name="from" label="From" value={r.fromStr} />
          <FilterDate name="to" label="To" value={r.toStr} />
        </FilterBar>
        <div className="flex flex-wrap gap-1.5 text-sm">
          {presets.map((p) => (
            <Link key={p.label} href={p.href} className={cn("rounded-lg border px-3 py-1.5", r.fromStr === isoDay(p.from) && r.toStr === isoDay(today) ? "border-umber-900 bg-umber-900 text-white" : "border-umber-200 bg-white text-umber-700 hover:border-umber-400")}>
              {p.label}
            </Link>
          ))}
        </div>
      </div>
      <nav className="flex flex-wrap gap-x-4 gap-y-1 border-b border-umber-200 pb-2 text-sm" aria-label="Report sections">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="text-umber-600 hover:text-umber-900">
            {s.label}
          </a>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <MiniStat label="GMV (PKR)" value={<SellerPrice pkr={data.gmvPkr} compact />} hint={`${r.days} days · paid, not refunded`} />
        <MiniStat label="Paid orders" value={String(data.paid.length)} hint={`${data.orders.length} placed`} />
        <MiniStat label="Average order (PKR)" value={aovPkr != null ? <SellerPrice pkr={aovPkr} compact /> : "—"} />
        <MiniStat label="Refund rate" value={percent(data.rates.refundRate)} hint="Orders with a processed refund / paid" />
        <MiniStat label="Dispute rate" value={percent(data.rates.disputeRate)} hint={`${openDisputes} still open`} tone={openDisputes ? "danger" : undefined} />
        <MiniStat label="Paid to artisans" value={<SellerPrice pkr={payoutPaid} compact />} hint={payoutOpen ? `${formatMoney(payoutOpen, "PKR", { compact: true })} awaiting` : "Nothing awaiting"} />
      </div>

      <Section
        id="gmv"
        title="GMV by month"
        description={
          <>
            Paid, non-refunded orders by payment month (months without sales are omitted from the table). The USD column normalises every currency through PKR at today&apos;s USD rate
            {usd ? (usd.status === "placeholder" ? " (placeholder rate — indicative only)" : ` (${usd.pkrPerUnit.toFixed(2)} PKR)`) : " (USD rate pending)"}.
          </>
        }
        exportHref={exp("gmv")}
      >
        <BarChart title="GMV per month in PKR" axisDivisor={100} labelEvery={data.months.length > 12 ? 2 : 1} data={data.months.map((m) => ({ key: m.key, label: m.label, value: m.pkr, display: `${formatMoney(m.pkr, "PKR")} · ${m.orders} order${m.orders === 1 ? "" : "s"}` }))} />
        <div className="mt-5 overflow-x-auto" tabIndex={0} role="region" aria-label="Sales by month table">
          <Table>
            <THead>
              <tr>
                <Th>Month</Th>
                <Th className="text-right">Orders</Th>
                {currencies.map((c) => (
                  <Th key={c} className="text-right">
                    {c}
                  </Th>
                ))}
                <Th className="text-right">PKR</Th>
                <Th className="text-right">≈ USD</Th>
              </tr>
            </THead>
            <TBody>
              {data.months.filter((m) => m.orders > 0).map((m) => (
                <Tr key={m.key}>
                  <Td className="text-sm">{m.label}</Td>
                  <Td className="text-right tabular-nums">{m.orders || <span className="text-umber-300">0</span>}</Td>
                  {currencies.map((c) => (
                    <Td key={c} className="text-right whitespace-nowrap">
                      {m.byCurrency[c] ? <OrderAmount amount={m.byCurrency[c]} currency={c} /> : <span className="text-umber-300">—</span>}
                    </Td>
                  ))}
                  <Td className="text-right">{m.pkr ? <SellerPrice pkr={m.pkr} /> : <span className="text-umber-300">—</span>}</Td>
                  <Td className="text-right whitespace-nowrap text-umber-600">{m.pkr ? (usd ? orderMoney(fromPkr(m.pkr, usd.pkrPerUnit), "USD") : <PendingBadge />) : <span className="text-umber-300">—</span>}</Td>
                </Tr>
              ))}
              <Tr className="font-medium">
                <Td className="text-sm">Total</Td>
                <Td className="text-right tabular-nums">{data.valuePaid.length}</Td>
                {currencies.map((c) => (
                  <Td key={c} className="text-right whitespace-nowrap">
                    <OrderAmount amount={data.months.reduce((a, m) => a + (m.byCurrency[c] ?? 0), 0)} currency={c} />
                  </Td>
                ))}
                <Td className="text-right">
                  <SellerPrice pkr={data.gmvPkr} />
                </Td>
                <Td className="text-right whitespace-nowrap text-umber-600">{usd ? orderMoney(fromPkr(data.gmvPkr, usd.pkrPerUnit), "USD") : <PendingBadge />}</Td>
              </Tr>
            </TBody>
          </Table>
        </div>
      </Section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section id="destinations" title="Orders by destination" description="Orders placed in the range; value from paid, non-refunded orders." exportHref={exp("destinations")}>
          <ShareBar parts={data.destinations.map((d, i) => ({ key: d.country, label: destinationName(d.country), value: d.pkr, display: destTotal ? percent(d.pkr / destTotal, 0) : "—", color: SERIES_COLORS[i % SERIES_COLORS.length] }))} />
          <Table className="mt-4" scrollLabel="Orders by destination">
            <THead>
              <tr>
                <Th>Destination</Th>
                <Th className="text-right">Placed</Th>
                <Th className="text-right">Paid</Th>
                <Th className="text-right">Value</Th>
                <Th className="text-right">PKR</Th>
              </tr>
            </THead>
            <TBody>
              {data.destinations.map((d) => (
                <Tr key={d.country}>
                  <Td className="text-sm">{destinationName(d.country)}</Td>
                  <Td className="text-right tabular-nums">{d.orders}</Td>
                  <Td className="text-right tabular-nums">{d.paid}</Td>
                  <Td className="text-right whitespace-nowrap">
                    {Object.entries(d.currencies).map(([c, v]) => (
                      <div key={c}>
                        <OrderAmount amount={v} currency={c} />
                      </div>
                    ))}
                    {!Object.keys(d.currencies).length ? <span className="text-umber-300">—</span> : null}
                  </Td>
                  <Td className="text-right">
                    <SellerPrice pkr={d.pkr} />
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
          {!data.destinations.length ? <p className="py-4 text-center text-sm text-umber-500">No orders in this range.</p> : null}
        </Section>

        <Section id="categories" title="Category performance" description="Artisan prices (PKR) of items on paid orders in the range." exportHref={exp("categories")}>
          <HBarList
            items={data.categories.map((c) => ({ key: c.id, label: `${c.name} · ${c.units} unit${c.units === 1 ? "" : "s"}`, value: c.pkr, display: `${formatMoney(c.pkr, "PKR")} · ${catTotal ? percent(c.pkr / catTotal, 0) : "—"}` }))}
            empty="No paid items in this range"
          />
        </Section>
      </div>

      <Section id="artisans" title="Artisan performance" description="Parcels on orders paid in the range, in PKR. Commission shows as pending where no rate was set on the order." exportHref={exp("artisans")}>
        {data.artisans.length ? (
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Report table">
            <Table>
              <THead>
                <tr>
                  <Th>Artisan</Th>
                  <Th className="text-right">Parcels</Th>
                  <Th className="text-right">Gross</Th>
                  <Th className="text-right">Share</Th>
                  <Th className="text-right">Commission</Th>
                  <Th className="text-right">Net to artisan</Th>
                  <Th className="text-right">Cancelled</Th>
                  <Th className="text-right">Disputes</Th>
                  <Th className="text-right">Rating</Th>
                </tr>
              </THead>
              <TBody>
                {data.artisans.map((a) => (
                  <Tr key={a.id}>
                    <Td>
                      <Link href={`/admin/artisans/${a.id}`} className="font-medium text-umber-900 hover:underline">
                        {a.name}
                      </Link>{" "}
                      <DemoBadge show={a.is_demo} />
                    </Td>
                    <Td className="text-right tabular-nums">{a.orders}</Td>
                    <Td className="text-right">
                      <SellerPrice pkr={a.gross} />
                    </Td>
                    <Td className="text-right tabular-nums text-umber-600">{artTotal ? percent(a.gross / artTotal, 0) : "—"}</Td>
                    <Td className="text-right">{a.commission_pending === a.orders ? <PendingBadge /> : <><SellerPrice pkr={a.commission} />{a.commission_pending ? <p className="text-xs text-pending-600">{a.commission_pending} pending</p> : null}</>}</Td>
                    <Td className="text-right">{a.commission_pending === a.orders ? <PendingBadge /> : <SellerPrice pkr={a.net} />}</Td>
                    <Td className="text-right tabular-nums">{a.cancelled ? `${a.cancelled} (${percent(ratio(a.cancelled, a.orders + a.cancelled), 0)})` : "0"}</Td>
                    <Td className={cn("text-right tabular-nums", a.disputes && "text-danger-700")}>{a.disputes}</Td>
                    <Td className="text-right text-sm whitespace-nowrap">{a.rating != null ? `${a.rating.toFixed(1)}★ (${a.reviews})` : <span className="text-umber-400">—</span>}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-umber-500">No paid parcels in this range.</p>
        )}
      </Section>

      <Section id="landed" title="Average landed-cost components" description="Per buyer currency, over non-cancelled orders placed in the range. Averages use known lines only; pending lines are counted separately." exportHref={exp("landed")}>
        {data.landed.length ? (
          <div className="grid gap-5 lg:grid-cols-3">
            {data.landed.map((c) => (
              <div key={c.currency} className="rounded-lg border border-umber-200 p-4">
                <div className="flex items-baseline justify-between">
                  <p className="font-medium text-umber-900">{c.currency}</p>
                  <p className="text-xs text-umber-500">
                    {c.orders} order{c.orders === 1 ? "" : "s"} · avg items {orderMoney(c.averageItems, c.currency)}
                  </p>
                </div>
                <dl className="mt-3 space-y-2.5 text-sm">
                  {c.components.map((k) => (
                    <div key={k.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2">
                      <dt className="text-umber-600">{k.label}</dt>
                      <dd className="font-medium">{k.average != null ? orderMoney(k.average, c.currency) : k.notApplicable === c.orders ? <span className="text-umber-400">Not applicable</span> : <PendingBadge />}</dd>
                      <dd className="col-span-2 text-xs text-umber-500">
                        {k.known} known{k.pending ? ` · ${k.pending} pending` : ""}
                        {k.notApplicable ? ` · ${k.notApplicable} n/a` : ""}
                        {k.shareOfItems != null ? ` · ${percent(k.shareOfItems, 0)} of items` : ""}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-umber-500">No orders in this range.</p>
        )}
      </Section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section id="refunds" title="Refunds & disputes" description="Refunds and cases opened in the range." exportHref={exp("refunds")}>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium tracking-wide text-umber-500 uppercase">Refunds</p>
              {data.refunds.length ? (
                <ul className="mt-2 space-y-1.5 text-sm">
                  {data.refunds.map((x) => (
                    <li key={`${x.currency}-${x.status}`} className="flex items-center justify-between gap-2">
                      <span>
                        <Badge tone={x.status === "processed" ? "success" : x.status === "rejected" ? "neutral" : "pending"}>{x.status}</Badge> <span className="text-umber-500">×{x.n}</span>
                      </span>
                      <OrderAmount amount={x.amount} currency={x.currency} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-umber-500">No refunds.</p>
              )}
              <p className="mt-3 text-xs text-umber-500">
                {refundsProcessed.length ? `${refundsProcessed.reduce((a, x) => a + x.orders, 0)} order(s) refunded` : "Nothing refunded"} · rate {percent(data.rates.refundRate)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium tracking-wide text-umber-500 uppercase">Disputes by reason</p>
              <div className="mt-2">
                <HBarList items={data.disputeReasons.map((d) => ({ key: d.reason, label: DISPUTE_REASON_LABEL[d.reason] ?? d.reason, value: d.n, display: String(d.n) }))} empty="No disputes" />
              </div>
              <p className="mt-3 text-xs text-umber-500">
                {data.disputes.map((d) => `${humanize(d.status)} ${d.n}`).join(" · ") || "—"} · rate {percent(data.rates.disputeRate)}
              </p>
            </div>
          </div>
        </Section>

        <Section id="payouts" title="Artisan payouts" description="Payouts created in the range, by status (PKR)." exportHref={exp("payouts")}>
          {data.payouts.length ? (
            <>
              <ShareBar parts={data.payouts.map((p, i) => ({ key: p.status, label: humanize(p.status), value: p.pkr, display: formatMoney(p.pkr, "PKR"), color: p.status === "paid" ? CURRENCY_COLORS.USD : SERIES_COLORS[(i % 3) + 1] }))} />
              <Table className="mt-4">
                <THead>
                  <tr>
                    <Th>Status</Th>
                    <Th className="text-right">Payouts</Th>
                    <Th className="text-right">Amount</Th>
                  </tr>
                </THead>
                <TBody>
                  {data.payouts.map((p) => (
                    <Tr key={p.status}>
                      <Td className="text-sm">{humanize(p.status)}</Td>
                      <Td className="text-right tabular-nums">{p.n}</Td>
                      <Td className="text-right">
                        <SellerPrice pkr={p.pkr} />
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </>
          ) : (
            <p className="py-6 text-center text-sm text-umber-500">No payouts in this range.</p>
          )}
          <p className="mt-3 text-xs text-umber-500">
            Paid out in the range: <SellerPrice pkr={payoutPaid} />. <Link href="/admin/payouts" className="underline">Manage payouts →</Link>
          </p>
        </Section>
      </div>
    </div>
  );
}
