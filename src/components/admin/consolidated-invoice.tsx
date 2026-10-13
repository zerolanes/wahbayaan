import Link from "next/link";
import { Notice } from "@/components/ui/misc";
import { orderMoney } from "@/lib/admin/money";
import { destinationName } from "@/lib/money/currency";
import { formatDate } from "@/lib/utils/format";
import type { OrderAddress, ShipmentDocItem } from "@/lib/db/schema";

type Hub = { name: string; city: string; country: string; address: { line1: string; line2?: string | null; region?: string | null; postalCode?: string | null }; contactPhone: string | null; contactEmail: string | null };
type Shipment = {
  reference: string;
  kind: string;
  courierName: string | null;
  trackingNumber: string | null;
  shippedAt: Date | null;
  weightG: number | null;
  lengthCm: string | null;
  widthCm: string | null;
  heightCm: string | null;
  volumetricWeightG: number | null;
  chargeableWeightG: number | null;
  documentItems: ShipmentDocItem[];
};
type Parcel = { reference: string; senderLabel: string; senderCity: string | null; measuredWeightG: number | null; bin: string | null };

/**
 * Commercial invoice + packing list for ONE consolidated export box: exporter =
 * the Wahbayaan hub, consignee = the buyer, one line per item with its HS code
 * and the seller it came from.
 */
export function ConsolidatedInvoice({ order, hub, shipment, parcels }: { order: { number: string; currency: string; email: string; isGift: boolean; destinationCountry: string; shippingAddress: OrderAddress }; hub: Hub; shipment: Shipment; parcels: Parcel[] }) {
  const cur = order.currency;
  const addr = order.shippingAddress;
  const items = shipment.documentItems;
  const value = items.reduce((a, i) => a + i.unitValue * i.qty, 0);
  const net = items.every((i) => i.weightG) ? items.reduce((a, i) => a + (i.weightG ?? 0) * i.qty, 0) : null;
  const problems = [...items.filter((i) => !i.hsCode).map((i) => `${i.title}: no HS code`), ...items.filter((i) => !i.weightG).map((i) => `${i.title}: no weight`)];
  const kg = (g: number | null | undefined) => (g ? `${(g / 1000).toFixed(2)} kg` : "—");
  const head = "mb-1 font-sans text-[11px] font-bold tracking-wider text-umber-600 uppercase";
  const sheet = "mx-auto max-w-[210mm] break-after-page rounded-2xl border border-umber-200 bg-white p-10 text-[13px] leading-snug text-black shadow-soft print:rounded-none print:border-0 print:p-0 print:shadow-none";
  const exporter = (
    <div>
      <h2 className={head}>Exporter</h2>
      <p className="font-semibold">Wahbayaan — {hub.name}</p>
      <p>{hub.address.line1}</p>
      {hub.address.line2 ? <p>{hub.address.line2}</p> : null}
      <p>{[hub.city, hub.address.region, hub.address.postalCode].filter(Boolean).join(", ")}</p>
      <p>{destinationName(hub.country)}</p>
      {hub.contactPhone ? <p>Tel {hub.contactPhone}</p> : null}
    </div>
  );
  const consignee = (
    <div>
      <h2 className={head}>Consignee / importer of record</h2>
      <p className="font-semibold">{addr.fullName}</p>
      <p>{addr.line1}</p>
      {addr.line2 ? <p>{addr.line2}</p> : null}
      <p>{[addr.city, addr.region, addr.postalCode].filter(Boolean).join(", ")}</p>
      <p>{destinationName(addr.country)}</p>
      {addr.phone ? <p>Tel {addr.phone}</p> : null}
      <p>{order.email}</p>
    </div>
  );
  return (
    <div className="space-y-6">
      {problems.length ? (
        <Notice tone="danger" title="Fix before printing — customs will reject incomplete invoices" className="print:hidden">
          <ul className="list-disc pl-4">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <p className="mt-1">
            Set HS codes on the <Link href="/admin/categories" className="underline">category</Link> or the listing. HS codes and duty treatment should be confirmed with a customs broker.
          </p>
        </Notice>
      ) : null}
      <article className={sheet}>
        <header className="flex items-start justify-between border-b-2 border-black pb-4">
          <div>
            <h1 className="font-sans text-2xl font-bold tracking-tight">COMMERCIAL INVOICE</h1>
            <p className="mt-1 text-xs text-umber-600">Consolidated export — {items.length} line{items.length === 1 ? "" : "s"} from {new Set(items.map((i) => i.sender)).size} seller{new Set(items.map((i) => i.sender)).size === 1 ? "" : "s"}</p>
          </div>
          <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-right text-xs">
            <dt className="text-umber-600">Invoice no.</dt>
            <dd className="font-mono font-semibold">{shipment.reference}</dd>
            <dt className="text-umber-600">Date</dt>
            <dd>{formatDate(shipment.shippedAt ?? new Date())}</dd>
            <dt className="text-umber-600">Order</dt>
            <dd>{order.number}</dd>
            <dt className="text-umber-600">AWB / tracking</dt>
            <dd className="font-mono">
              {shipment.courierName} {shipment.trackingNumber}
            </dd>
          </dl>
        </header>
        <section className="mt-5 grid grid-cols-2 gap-6">
          {exporter}
          {consignee}
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
              <tr key={n} className="border-b border-umber-200 align-top">
                <td className="py-1.5 pr-2">{n + 1}</td>
                <td className="py-1.5 pr-2">
                  <p className="font-medium">{i.title}</p>
                  <p className="text-umber-600">Made by {i.sender}</p>
                </td>
                <td className="py-1.5 pr-2 font-mono">{i.hsCode ?? <span className="text-danger-700">MISSING</span>}</td>
                <td className="py-1.5 pr-2">{i.origin}</td>
                <td className="py-1.5 pr-2 text-right">{i.qty}</td>
                <td className="py-1.5 pr-2 text-right">{i.weightG ? kg(i.weightG) : <span className="text-danger-700">MISSING</span>}</td>
                <td className="py-1.5 pr-2 text-right whitespace-nowrap">{orderMoney(i.unitValue, cur)}</td>
                <td className="py-1.5 text-right whitespace-nowrap">{orderMoney(i.unitValue * i.qty, cur)}</td>
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
        <section className="mt-5 grid grid-cols-4 gap-4 text-xs">
          <div>
            <p className="text-umber-600">Packages</p>
            <p className="font-semibold">1</p>
          </div>
          <div>
            <p className="text-umber-600">Net weight (goods)</p>
            <p className="font-semibold">{kg(net)}</p>
          </div>
          <div>
            <p className="text-umber-600">Gross weight (packed)</p>
            <p className="font-semibold">{kg(shipment.weightG)}</p>
          </div>
          <div>
            <p className="text-umber-600">Dimensions</p>
            <p className="font-semibold">
              {shipment.lengthCm}×{shipment.widthCm}×{shipment.heightCm} cm
            </p>
          </div>
        </section>
        <p className="mt-5 text-xs text-umber-700">
          Currency of declared values: {cur}. Freight and insurance are invoiced separately to the buyer. Import duties and taxes of {destinationName(order.destinationCountry)} are the responsibility of the consignee.
        </p>
        <p className="mt-3 text-xs">I declare that the information on this invoice is true and correct, and that the goods described are of Pakistani origin.</p>
        <div className="mt-10 grid grid-cols-2 gap-10 text-xs">
          <div className="border-t border-black pt-1">Signature of exporter</div>
          <div className="border-t border-black pt-1">Name, date and place</div>
        </div>
      </article>

      <article className={sheet}>
        <header className="flex items-start justify-between border-b-2 border-black pb-4">
          <h1 className="font-sans text-2xl font-bold tracking-tight">PACKING LIST</h1>
          <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 text-right text-xs">
            <dt className="text-umber-600">Box</dt>
            <dd className="font-mono font-semibold">{shipment.reference}</dd>
            <dt className="text-umber-600">Order</dt>
            <dd>{order.number}</dd>
          </dl>
        </header>
        <section className="mt-5 grid grid-cols-2 gap-6">
          {exporter}
          {consignee}
        </section>
        <section className="mt-5 grid grid-cols-4 gap-4 border-y border-umber-300 py-3 text-xs">
          <div>
            <p className="text-umber-600">Gross weight</p>
            <p className="font-semibold">{kg(shipment.weightG)}</p>
          </div>
          <div>
            <p className="text-umber-600">Dimensions</p>
            <p className="font-semibold">
              {shipment.lengthCm}×{shipment.widthCm}×{shipment.heightCm} cm
            </p>
          </div>
          <div>
            <p className="text-umber-600">Volumetric weight</p>
            <p className="font-semibold">{kg(shipment.volumetricWeightG)}</p>
          </div>
          <div>
            <p className="text-umber-600">Chargeable weight</p>
            <p className="font-semibold">{kg(shipment.chargeableWeightG)}</p>
          </div>
        </section>
        <table className="mt-5 w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-black text-left">
              <th className="py-1.5 pr-2">Seller parcel</th>
              <th className="py-1.5 pr-2">From</th>
              <th className="py-1.5 pr-2">Contents</th>
              <th className="py-1.5 text-right">Weight at hub</th>
            </tr>
          </thead>
          <tbody>
            {parcels.map((p) => (
              <tr key={p.reference} className="border-b border-umber-200 align-top">
                <td className="py-1.5 pr-2 font-mono">{p.reference}</td>
                <td className="py-1.5 pr-2">
                  {p.senderLabel}
                  {p.senderCity ? `, ${p.senderCity}` : ""}
                </td>
                <td className="py-1.5 pr-2">
                  {items
                    .filter((i) => i.sender === p.senderLabel)
                    .map((i) => `${i.qty} × ${i.title}`)
                    .join("; ")}
                </td>
                <td className="py-1.5 text-right">{kg(p.measuredWeightG)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </div>
  );
}
