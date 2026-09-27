import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { PrintButton } from "@/components/admin/client-bits";
import { Breadcrumbs, Notice } from "@/components/ui/misc";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { orders, products, users } from "@/lib/db/schema";
import { orderMoney } from "@/lib/admin/money";
import { destinationName } from "@/lib/money/currency";
import { formatDate, regionLabel } from "@/lib/utils/format";

export async function generateMetadata(props: PageProps<"/admin/orders/[number]/invoice">) {
  const { number } = await props.params;
  return { title: `Commercial invoice ${number}` };
}

/**
 * Printable commercial invoice, one per artisan parcel: shipper = the artisan's
 * workshop in Pakistan, consignee = the buyer. Generated from order data.
 */
export default async function InvoicePage(props: PageProps<"/admin/orders/[number]/invoice">) {
  await requireStaff("orders.view");
  const { number } = await props.params;
  const d = await db();
  const order = await d.query.orders.findFirst({
    where: eq(orders.number, decodeURIComponent(number)),
    with: { items: true, vendorOrders: { with: { vendor: true } } },
  });
  if (!order) notFound();
  const productIds = order.items.map((i) => i.productId).filter((x): x is string => !!x);
  const prods = productIds.length ? await d.query.products.findMany({ where: inArray(products.id, productIds), with: { category: true } }) : [];
  const vendorUserIds = order.vendorOrders.map((v) => v.vendor.userId);
  const vendorUsers = vendorUserIds.length ? await d.select({ id: users.id, phone: users.phone, email: users.email }).from(users).where(inArray(users.id, vendorUserIds)) : [];
  const cur = order.currency;
  const addr = order.shippingAddress;
  const parcels = order.vendorOrders.map((vo, idx) => {
    const items = order.items
      .filter((i) => i.vendorOrderId === vo.id)
      .map((i) => {
        const p = prods.find((x) => x.id === i.productId);
        return {
          ...i,
          hs: i.hsCode ?? p?.hsCodeOverride ?? p?.category.hsCode ?? null,
          weightG: p?.weightG ?? null,
          materials: p?.materials ?? [],
          category: p?.category.name ?? null,
        };
      });
    const netWeight = items.reduce((a, i) => a + (i.weightG ?? 0) * i.qty, 0);
    const value = items.reduce((a, i) => a + i.unitPrice * i.qty, 0);
    return { vo, idx, items, netWeight, value, missingHs: items.filter((i) => !i.hs), missingWeight: items.filter((i) => !i.weightG) };
  });
  const problems = parcels.flatMap((p) => [
    ...p.missingHs.map((i) => `${i.title}: no HS code`),
    ...p.missingWeight.map((i) => `${i.title}: no weight`),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Breadcrumbs items={[{ label: "Orders", href: "/admin/orders" }, { label: order.number, href: `/admin/orders/${order.number}` }, { label: "Commercial invoice" }]} />
        <PrintButton>Print {parcels.length > 1 ? `${parcels.length} invoices` : "invoice"}</PrintButton>
      </div>
      {problems.length ? (
        <Notice tone="danger" title="Fix before printing — customs will reject incomplete invoices" className="print:hidden">
          <ul className="list-disc pl-4">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <p className="mt-1">
            Set HS codes on the <Link href="/admin/categories" className="underline">category</Link> or the listing, and weights on each listing.
          </p>
        </Notice>
      ) : null}
      {!order.totalComplete ? (
        <Notice tone="pending" className="print:hidden" title="This order's total is not confirmed yet">
          Values below are the item prices only. Print after the quote is paid.
        </Notice>
      ) : null}

      {parcels.map(({ vo, idx, items, netWeight, value }) => {
        const vu = vendorUsers.find((u) => u.id === vo.vendor.userId);
        return (
          <article key={vo.id} className="mx-auto max-w-[210mm] break-after-page rounded-2xl border border-umber-200 bg-white p-10 text-[13px] leading-snug text-black shadow-soft print:rounded-none print:border-0 print:p-0 print:shadow-none">
            <header className="flex items-start justify-between border-b-2 border-black pb-4">
              <div>
                <h1 className="font-sans text-2xl font-bold tracking-tight">COMMERCIAL INVOICE</h1>
                <p className="mt-1 text-xs text-umber-600">Coordinated by Wahbayaan on behalf of the shipper</p>
              </div>
              <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-right text-xs">
                <dt className="text-umber-600">Invoice no.</dt>
                <dd className="font-mono font-semibold">
                  {order.number}-{idx + 1}
                </dd>
                <dt className="text-umber-600">Date</dt>
                <dd>{formatDate(vo.shippedAt ?? new Date())}</dd>
                <dt className="text-umber-600">Order</dt>
                <dd>{order.number}</dd>
                <dt className="text-umber-600">Parcel</dt>
                <dd>
                  {idx + 1} of {parcels.length}
                </dd>
                {vo.trackingNumber ? (
                  <>
                    <dt className="text-umber-600">AWB / tracking</dt>
                    <dd className="font-mono">
                      {vo.courier} {vo.trackingNumber}
                    </dd>
                  </>
                ) : null}
              </dl>
            </header>

            <section className="mt-5 grid grid-cols-2 gap-6">
              <div>
                <h2 className="mb-1 font-sans text-[11px] font-bold tracking-wider text-umber-600 uppercase">Shipper / exporter</h2>
                <p className="font-semibold">{vo.vendor.displayName}</p>
                <p>{vo.vendor.craft} workshop</p>
                <p>
                  {[vo.vendor.workshopCity, regionLabel(vo.vendor.workshopRegion)].filter(Boolean).join(", ") || <span className="text-danger-700">Workshop address missing</span>}
                </p>
                <p>Pakistan</p>
                {vu?.phone ? <p>Tel {vu.phone}</p> : null}
                {vu?.email ? <p>{vu.email}</p> : null}
              </div>
              <div>
                <h2 className="mb-1 font-sans text-[11px] font-bold tracking-wider text-umber-600 uppercase">Consignee / importer of record</h2>
                <p className="font-semibold">{addr.fullName}</p>
                <p>{addr.line1}</p>
                {addr.line2 ? <p>{addr.line2}</p> : null}
                <p>{[addr.city, addr.region, addr.postalCode].filter(Boolean).join(", ")}</p>
                <p>{destinationName(addr.country)}</p>
                {addr.phone ? <p>Tel {addr.phone}</p> : null}
                <p>{order.email}</p>
              </div>
            </section>

            <section className="mt-5 grid grid-cols-4 gap-4 border-y border-umber-300 py-3 text-xs">
              <div>
                <p className="text-umber-600">Country of origin</p>
                <p className="font-semibold">Pakistan (PK)</p>
              </div>
              <div>
                <p className="text-umber-600">Destination</p>
                <p className="font-semibold">
                  {destinationName(order.destinationCountry)} ({order.destinationCountry})
                </p>
              </div>
              <div>
                <p className="text-umber-600">Reason for export</p>
                <p className="font-semibold">{order.isGift ? "Sale — gift to recipient" : "Sale of goods"}</p>
              </div>
              <div>
                <p className="text-umber-600">Terms of delivery</p>
                <p className="font-semibold">DAP — duties and taxes paid by buyer</p>
              </div>
            </section>

            <table className="mt-5 w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-black text-left">
                  <th className="py-1.5 pr-2">#</th>
                  <th className="py-1.5 pr-2">Description of goods</th>
                  <th className="py-1.5 pr-2">HS code</th>
                  <th className="py-1.5 pr-2">Origin</th>
                  <th className="py-1.5 pr-2 text-right">Qty</th>
                  <th className="py-1.5 pr-2 text-right">Unit wt</th>
                  <th className="py-1.5 pr-2 text-right">Unit value</th>
                  <th className="py-1.5 text-right">Total ({cur})</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i, n) => (
                  <tr key={i.id} className="border-b border-umber-200 align-top">
                    <td className="py-1.5 pr-2">{n + 1}</td>
                    <td className="py-1.5 pr-2">
                      <p className="font-medium">{i.title}</p>
                      <p className="text-umber-600">
                        Handmade{i.category ? ` · ${i.category}` : ""}
                        {i.materials.length ? ` · ${i.materials.join(", ")}` : ""}
                      </p>
                    </td>
                    <td className="py-1.5 pr-2 font-mono">{i.hs ?? <span className="text-danger-700">MISSING</span>}</td>
                    <td className="py-1.5 pr-2">PK</td>
                    <td className="py-1.5 pr-2 text-right">{i.qty}</td>
                    <td className="py-1.5 pr-2 text-right">{i.weightG ? `${(i.weightG / 1000).toFixed(2)} kg` : <span className="text-danger-700">MISSING</span>}</td>
                    <td className="py-1.5 pr-2 text-right whitespace-nowrap">{orderMoney(i.unitPrice, cur)}</td>
                    <td className="py-1.5 text-right whitespace-nowrap">{orderMoney(i.unitPrice * i.qty, cur)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6} className="pt-3 text-right text-umber-600">
                    Total declared value of goods
                  </td>
                  <td colSpan={2} className="pt-3 text-right font-bold whitespace-nowrap">
                    {orderMoney(value, cur)}
                  </td>
                </tr>
              </tfoot>
            </table>

            <section className="mt-5 grid grid-cols-3 gap-4 text-xs">
              <div>
                <p className="text-umber-600">Number of packages</p>
                <p className="font-semibold">1</p>
              </div>
              <div>
                <p className="text-umber-600">Net weight (goods)</p>
                <p className="font-semibold">{netWeight ? `${(netWeight / 1000).toFixed(2)} kg` : "—"}</p>
              </div>
              <div>
                <p className="text-umber-600">Gross weight (packed)</p>
                <p className="font-semibold">{vo.packageWeightG ? `${(vo.packageWeightG / 1000).toFixed(2)} kg` : "To be weighed at dispatch"}</p>
              </div>
            </section>

            <p className="mt-5 text-xs text-umber-700">
              Currency of declared values: {cur}. Freight and insurance are invoiced separately to the buyer. Import duties and taxes of {destinationName(order.destinationCountry)} are
              the responsibility of the consignee.
            </p>
            <p className="mt-3 text-xs">
              I declare that the information on this invoice is true and correct, and that the goods described are handmade in Pakistan and are of Pakistani origin.
            </p>
            <div className="mt-10 grid grid-cols-2 gap-10 text-xs">
              <div className="border-t border-black pt-1">Signature of shipper</div>
              <div className="border-t border-black pt-1">Name, date and place</div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
