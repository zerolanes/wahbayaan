import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { Empty, FilterBar, FilterSelect, MiniStat, OrderAmount, TableCard } from "@/components/admin/ui";
import { Badge, PageHeader } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { str } from "@/lib/admin/params";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/lib/commerce/orders";
import { db } from "@/lib/db/client";
import { orders } from "@/lib/db/schema";
import { destinationName } from "@/lib/money/currency";
import { formatDateTime } from "@/lib/utils/format";

export const metadata = { title: "Brand orders & requests" };

const NEXT: Record<string, string> = {
  awaiting_quote: "Price items / confirm costs, send quote",
  quote_sent: "Waiting for the buyer to approve",
  awaiting_payment: "Waiting for payment",
  paid: "Buy from the brand",
  in_fulfilment: "Receive, check and dispatch",
  shipped: "In transit",
  delivered: "Waiting for buyer confirmation",
};

export default async function BrandRequestsPage(props: PageProps<"/admin/brand-requests">) {
  await requireStaff("orders.view");
  const params = await props.searchParams;
  const flow = str(params, "flow");
  const status = str(params, "status");
  const d = await db();
  const rows = await d.query.orders.findMany({
    where: and(eq(orders.kind, "brand"), flow ? eq(orders.brandFlow, flow) : undefined, status ? eq(orders.status, status as never) : undefined),
    with: { brandItems: { columns: { id: true, brandName: true, title: true, qty: true } }, brandFulfilments: true },
    orderBy: desc(orders.createdAt),
    limit: 200,
  });
  const all = await d.select({ status: orders.status, flow: orders.brandFlow }).from(orders).where(eq(orders.kind, "brand"));
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pakistani Brands"
        title="Brand orders & requests"
        description="Wahbayaan buys from the brand on the buyer's behalf. Link requests need each item checked and priced; then the quote is computed with the service-fee settings and courier rates — anything still pending must be confirmed before it's sent."
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Requests to price" value={String(all.filter((o) => o.flow === "link_request" && o.status === "awaiting_quote").length)} href="/admin/brand-requests?flow=link_request&status=awaiting_quote" tone="pending" />
        <MiniStat label="Catalogue orders awaiting a quote" value={String(all.filter((o) => o.flow === "catalogue" && o.status === "awaiting_quote").length)} href="/admin/brand-requests?flow=catalogue&status=awaiting_quote" />
        <MiniStat label="Paid — buy from the brand" value={String(all.filter((o) => o.status === "paid").length)} href="/admin/brand-requests?status=paid" />
        <MiniStat label="Being fulfilled" value={String(all.filter((o) => o.status === "in_fulfilment").length)} href="/admin/brand-requests?status=in_fulfilment" />
      </div>
      <TableCard
        toolbar={
          <FilterBar action="/admin/brand-requests">
            <FilterSelect name="flow" label="Type" value={flow} options={[{ value: "link_request", label: "Shop by link" }, { value: "catalogue", label: "Catalogue" }]} />
            <FilterSelect name="status" label="Status" value={status} options={Object.entries(ORDER_STATUS_LABEL).map(([value, label]) => ({ value, label }))} />
          </FilterBar>
        }
      >
        {rows.length ? (
          <Table>
            <THead>
              <tr>
                <Th>Order</Th>
                <Th>Items</Th>
                <Th>Ship to</Th>
                <Th>Status</Th>
                <Th>Next step</Th>
                <Th className="text-right">Total</Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((o) => (
                <Tr key={o.id}>
                  <Td>
                    <Link href={`/admin/orders/${o.number}`} className="font-mono font-medium text-indigo-800 hover:underline">
                      {o.number}
                    </Link>
                    <p className="text-xs text-umber-500">
                      {o.customerName} · {formatDateTime(o.createdAt)}
                    </p>
                    <Badge tone={o.brandFlow === "link_request" ? "gold" : "indigo"} className="mt-1">
                      {o.brandFlow === "link_request" ? "Shop by link" : "Catalogue"}
                    </Badge>
                  </Td>
                  <Td className="max-w-80 text-sm">
                    {o.brandItems.slice(0, 3).map((i) => (
                      <p key={i.id} className="truncate">
                        {i.qty} × {i.title} <span className="text-umber-500">· {i.brandName}</span>
                      </p>
                    ))}
                    {o.brandItems.length > 3 ? <p className="text-xs text-umber-500">+ {o.brandItems.length - 3} more</p> : null}
                  </Td>
                  <Td className="text-sm">
                    {destinationName(o.destinationCountry)}
                    {o.isGift ? <p className="text-xs text-umber-500">gift · buyer pays {o.currency}</p> : null}
                  </Td>
                  <Td>
                    <Badge tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>
                  </Td>
                  <Td className="text-sm text-umber-700">{NEXT[o.status] ?? "—"}</Td>
                  <Td className="text-right text-sm">{o.totalComplete ? <OrderAmount amount={o.total} currency={o.currency} /> : <Badge tone="pending">Quote pending</Badge>}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        ) : (
          <Empty>No brand orders match.</Empty>
        )}
      </TableCard>
    </div>
  );
}
