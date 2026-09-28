import Link from "next/link";
import { asc } from "drizzle-orm";
import { Gift } from "lucide-react";
import { bulkOrdersAction } from "@/app/actions/admin/orders";
import { BulkBar, RowCheck, SelectAll } from "@/components/admin/bulk";
import { DemoBadge, Empty, ExportLink, FilterBar, FilterDate, FilterSelect, OrderAmount, PendingBadge, StatusBadge, TableCard } from "@/components/admin/ui";
import { Badge, PageHeader, Pagination, Tabs } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { vendors } from "@/lib/db/schema";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/lib/commerce/orders";
import { listOrders, ORDER_SORTS, ORDER_TABS, orderStatusCounts } from "@/lib/admin/orders";
import { hrefWith, pageCount, pageOf, str, PAGE_SIZE } from "@/lib/admin/params";
import { DESTINATIONS, destinationName } from "@/lib/money/currency";
import { formatDate } from "@/lib/utils/format";

export const metadata = { title: "Orders" };

export default async function OrdersPage(props: PageProps<"/admin/orders">) {
  const user = await requireStaff("orders.view");
  const params = await props.searchParams;
  const page = pageOf(params);
  const status = str(params, "status");
  const d = await db();
  const [{ rows, total }, counts, artisans] = await Promise.all([
    listOrders(params, page, PAGE_SIZE),
    orderStatusCounts(params),
    d.select({ id: vendors.id, name: vendors.displayName }).from(vendors).orderBy(asc(vendors.displayName)),
  ]);
  const exportHref = hrefWith("/admin/export/orders", params, {});
  const canBulk = user.permissions.has("orders.manage") || user.permissions.has("escrow.release");

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Orders & money" title="Orders" description="Every order across destinations. Totals are in the buyer's currency with its code; pending lines mean a quote is still needed." />
      <Tabs items={ORDER_TABS.map((t) => ({ label: t.label, href: hrefWith("/admin/orders", params, { status: t.value || null }), active: status === t.value, count: counts[t.value] ?? 0 }))} />
      <FilterBar action="/admin/orders" q={str(params, "q")} placeholder="Order number, email or name" extra={user.permissions.has("reports.view") || user.permissions.has("orders.view") ? <ExportLink href={exportHref} /> : null}>
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <FilterSelect name="destination" label="Destination" value={str(params, "destination")} options={DESTINATIONS.map((x) => ({ value: x.code, label: x.name }))} />
        <FilterSelect name="currency" label="Currency" value={str(params, "currency")} options={["USD", "GBP", "CAD", "PKR"].map((c) => ({ value: c, label: c }))} />
        <FilterSelect name="funds" label="Funds" value={str(params, "funds")} options={["none", "held", "frozen", "released", "refunded"].map((c) => ({ value: c, label: c }))} />
        <FilterSelect name="artisan" label="Artisan" value={str(params, "artisan")} options={artisans.map((a) => ({ value: a.id, label: a.name }))} />
        <FilterDate name="from" label="From" value={str(params, "from")} />
        <FilterDate name="to" label="To" value={str(params, "to")} />
        <FilterSelect name="sort" label="Sort" value={str(params, "sort")} options={ORDER_SORTS.filter((s) => s.value !== "newest").map((s) => ({ value: s.value, label: s.label }))} />
      </FilterBar>

      <TableCard
        toolbar={
          <>
            <p className="text-sm text-umber-600">
              {total} order{total === 1 ? "" : "s"}
            </p>
            {canBulk ? (
              <BulkBar
                formId="orders-bulk"
                action={bulkOrdersAction}
                options={[
                  { value: "email_status", label: "Email buyers a status update", confirm: "Email the selected buyers?" },
                  { value: "release", label: "Release held funds (delivered only)", confirm: "Release held funds to artisans?" },
                ]}
              />
            ) : null}
          </>
        }
        footer={<Pagination page={page} pageCount={pageCount(total)} hrefFor={(p) => hrefWith("/admin/orders", params, { page: p })} />}
      >
        {rows.length ? (
          <Table>
            <THead>
              <tr>
                {canBulk ? (
                  <Th className="w-8">
                    <SelectAll formId="orders-bulk" />
                  </Th>
                ) : null}
                <Th>Order</Th>
                <Th>Placed</Th>
                <Th>Customer</Th>
                <Th>Artisans</Th>
                <Th className="text-right">Total</Th>
                <Th>Status · funds</Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((o) => (
                <Tr key={o.id}>
                  {canBulk ? (
                    <Td>
                      <RowCheck formId="orders-bulk" value={o.id} label={`Select ${o.number}`} />
                    </Td>
                  ) : null}
                  <Td>
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <Link href={`/admin/orders/${o.number}`} className="font-medium text-indigo-800 hover:underline">
                        {o.number}
                      </Link>
                      {o.isGift ? <Gift className="size-3.5 text-terracotta-500" aria-label="Gift" /> : null}
                      <DemoBadge show={o.isDemo} />
                    </div>
                  </Td>
                  <Td className="whitespace-nowrap text-umber-600">{formatDate(o.createdAt)}</Td>
                  <Td>
                    <p className="text-umber-900">{o.customerName}</p>
                    <p className="text-xs text-umber-500">
                      {o.email} · {destinationName(o.destinationCountry)}
                    </p>
                  </Td>
                  <Td className="max-w-48">
                    <p className="truncate text-umber-700">{o.vendors.map((v) => v.name).join(", ") || "—"}</p>
                  </Td>
                  <Td className="text-right whitespace-nowrap">
                    <OrderAmount amount={o.total} currency={o.currency} className="font-medium" />
                    {!o.totalComplete ? (
                      <div>
                        <PendingBadge>Lines pending</PendingBadge>
                      </div>
                    ) : null}
                  </Td>
                  <Td>
                    <div className="flex flex-col items-start gap-1">
                      <Badge tone={ORDER_STATUS_TONE[o.status] ?? "neutral"}>{ORDER_STATUS_LABEL[o.status] ?? o.status}</Badge>
                      {o.fundsState !== "none" ? <StatusBadge kind="funds" status={o.fundsState} label={`Funds ${o.fundsState}`} /> : null}
                    </div>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        ) : (
          <Empty>No orders match these filters.</Empty>
        )}
      </TableCard>
    </div>
  );
}
