import { csvAmount, csvResponse, toCsv } from "@/lib/admin/csv";
import { str } from "@/lib/admin/params";
import { reportData } from "@/lib/admin/reports-data";
import { paramsOf, staffForRoute } from "@/lib/admin/route-auth";

const REPORTS = ["gmv", "destinations", "categories", "artisans", "landed", "refunds", "payouts"] as const;
type Report = (typeof REPORTS)[number];

export async function GET(req: Request) {
  const auth = await staffForRoute("reports.view");
  if ("error" in auth) return auth.error;
  const params = paramsOf(req);
  const report = str(params, "report") as Report;
  if (!REPORTS.includes(report)) return new Response(`Unknown report. Use one of: ${REPORTS.join(", ")}`, { status: 400 });
  const data = await reportData(params);
  const name = `wahbayaan-${report}-${data.range.fromStr}-to-${data.range.toStr}.csv`;

  switch (report) {
    case "gmv": {
      const currencies = [...new Set(data.months.flatMap((m) => Object.keys(m.byCurrency)))].sort();
      return csvResponse(
        name,
        toCsv(data.months, [
          { header: "Month", value: (m) => m.key },
          { header: "Paid orders", value: (m) => m.orders },
          ...currencies.map((c) => ({ header: `GMV ${c}`, value: (m: (typeof data.months)[number]) => csvAmount(m.byCurrency[c] ?? 0) })),
          { header: "GMV PKR (order rates)", value: (m) => csvAmount(m.pkr) },
        ]),
      );
    }
    case "destinations":
      return csvResponse(
        name,
        toCsv(data.destinations, [
          { header: "Destination", value: (d) => d.country },
          { header: "Orders placed", value: (d) => d.orders },
          { header: "Paid orders", value: (d) => d.paid },
          { header: "Value by currency", value: (d) => Object.entries(d.currencies).map(([c, v]) => `${csvAmount(v)} ${c}`) },
          { header: "Value PKR", value: (d) => csvAmount(d.pkr) },
        ]),
      );
    case "categories":
      return csvResponse(
        name,
        toCsv(data.categories, [
          { header: "Category", value: (c) => c.name },
          { header: "Paid orders", value: (c) => c.orders },
          { header: "Units", value: (c) => c.units },
          { header: "Artisan value PKR", value: (c) => csvAmount(c.pkr) },
        ]),
      );
    case "artisans":
      return csvResponse(
        name,
        toCsv(data.artisans, [
          { header: "Artisan", value: (a) => a.name },
          { header: "Parcels", value: (a) => a.orders },
          { header: "Cancelled parcels", value: (a) => a.cancelled },
          { header: "Gross PKR", value: (a) => csvAmount(a.gross) },
          { header: "Commission PKR", value: (a) => (a.commission_pending === a.orders ? "pending" : csvAmount(a.commission)) },
          { header: "Parcels with commission pending", value: (a) => a.commission_pending },
          { header: "Net PKR", value: (a) => (a.commission_pending === a.orders ? "pending" : csvAmount(a.net)) },
          { header: "Disputes", value: (a) => a.disputes },
          { header: "Average rating", value: (a) => a.rating },
          { header: "Published reviews", value: (a) => a.reviews },
          { header: "Demo", value: (a) => (a.is_demo ? "yes" : "no") },
        ]),
      );
    case "landed": {
      const rows = data.landed.flatMap((c) => c.components.map((k) => ({ currency: c.currency, orders: c.orders, ...k })));
      return csvResponse(
        name,
        toCsv(rows, [
          { header: "Currency", value: (r) => r.currency },
          { header: "Component", value: (r) => r.label },
          { header: "Orders", value: (r) => r.orders },
          { header: "Known", value: (r) => r.known },
          { header: "Pending", value: (r) => r.pending },
          { header: "Not applicable", value: (r) => r.notApplicable },
          { header: "Average (known only)", value: (r) => (r.average == null ? "pending" : csvAmount(r.average)) },
          { header: "Share of items", value: (r) => (r.shareOfItems == null ? "" : r.shareOfItems.toFixed(4)) },
        ]),
      );
    }
    case "refunds":
      return csvResponse(
        name,
        toCsv(
          [
            ...data.refunds.map((x) => ({ kind: "refund", key: `${x.status} ${x.currency}`, count: x.n, amount: `${csvAmount(x.amount)} ${x.currency}` })),
            ...data.disputeReasons.map((x) => ({ kind: "dispute reason", key: x.reason, count: x.n, amount: "" })),
            ...data.disputes.map((x) => ({ kind: "dispute status", key: x.status, count: x.n, amount: "" })),
            { kind: "rate", key: "refund rate", count: data.rates.refundRate ?? "", amount: "" },
            { kind: "rate", key: "dispute rate", count: data.rates.disputeRate ?? "", amount: "" },
          ],
          [
            { header: "Kind", value: (r) => r.kind },
            { header: "Item", value: (r) => r.key },
            { header: "Count / rate", value: (r) => r.count },
            { header: "Amount", value: (r) => r.amount },
          ],
        ),
      );
    case "payouts":
      return csvResponse(
        name,
        toCsv(data.payouts, [
          { header: "Status", value: (p) => p.status },
          { header: "Payouts", value: (p) => p.n },
          { header: "Amount PKR", value: (p) => csvAmount(p.pkr) },
          { header: "Paid within range PKR", value: (p) => csvAmount(p.paidInRange) },
        ]),
      );
  }
}
