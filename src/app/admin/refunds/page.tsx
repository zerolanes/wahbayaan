import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { updateRefundStatusAction } from "@/app/actions/admin/orders";
import { ActionButton } from "@/components/admin/action-form";
import { DemoBadge, Empty, ExportLink, FilterBar, FilterDate, FilterSelect, MiniStat, OrderAmount, StatusBadge, TableCard } from "@/components/admin/ui";
import { PageHeader, Pagination } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { disputes, orders, refunds, users } from "@/lib/db/schema";
import { orderMoney } from "@/lib/admin/money";
import { hrefWith, pageCount, pageOf, str, PAGE_SIZE } from "@/lib/admin/params";
import { refundConditions } from "@/lib/admin/filters";
import { formatDateTime } from "@/lib/utils/format";

export const metadata = { title: "Refunds" };

export default async function RefundsPage(props: PageProps<"/admin/refunds">) {
  await requireStaff("orders.refund");
  const params = await props.searchParams;
  const page = pageOf(params);
  const d = await db();
  const where = and(...refundConditions(params));
  const [rows, [{ n }], totals] = await Promise.all([
    d
      .select({ r: refunds, number: orders.number, customer: orders.customerName, isDemo: orders.isDemo, by: users.name, caseNumber: disputes.number })
      .from(refunds)
      .innerJoin(orders, eq(orders.id, refunds.orderId))
      .leftJoin(users, eq(users.id, refunds.createdById))
      .leftJoin(disputes, eq(disputes.id, refunds.disputeId))
      .where(where)
      .orderBy(desc(refunds.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    d.select({ n: sql<number>`count(*)::int` }).from(refunds).innerJoin(orders, eq(orders.id, refunds.orderId)).where(where),
    d
      .select({ currency: refunds.currency, status: refunds.status, total: sql<string>`sum(${refunds.amount})::bigint`, n: sql<number>`count(*)::int` })
      .from(refunds)
      .innerJoin(orders, eq(orders.id, refunds.orderId))
      .where(where)
      .groupBy(refunds.currency, refunds.status),
  ]);
  const processed = totals.filter((t) => t.status === "processed");
  const requested = totals.filter((t) => t.status === "requested");
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Orders & money" title="Refunds" description="Every refund issued to buyers, in the order's currency. Refunds are issued from an order or by resolving a case." />
      <div className="grid gap-4 sm:grid-cols-3">
        <MiniStat label="Refunded (filtered)" value={processed.length ? processed.map((t) => orderMoney(Number(t.total), t.currency)).join(" · ") : "—"} hint={`${processed.reduce((a, t) => a + Number(t.n), 0)} refunds processed`} />
        <MiniStat label="Requested, not processed" value={requested.reduce((a, t) => a + Number(t.n), 0)} hint={requested.map((t) => orderMoney(Number(t.total), t.currency)).join(" · ") || "None"} />
        <MiniStat label="Linked to cases" value={rows.filter((r) => r.r.disputeId).length} hint="On this page" />
      </div>
      <FilterBar action="/admin/refunds" q={str(params, "q")} placeholder="Order number, email or reason" extra={<ExportLink href={hrefWith("/admin/export/refunds", params, {})} />}>
        <FilterSelect name="status" label="Status" value={str(params, "status")} options={["requested", "approved", "processed", "rejected"].map((s) => ({ value: s, label: s }))} />
        <FilterSelect name="currency" label="Currency" value={str(params, "currency")} options={["USD", "GBP", "CAD", "PKR"].map((c) => ({ value: c, label: c }))} />
        <FilterDate name="from" label="From" value={str(params, "from")} />
        <FilterDate name="to" label="To" value={str(params, "to")} />
      </FilterBar>
      <TableCard footer={<Pagination page={page} pageCount={pageCount(Number(n))} hrefFor={(p) => hrefWith("/admin/refunds", params, { page: p })} />}>
        {rows.length ? (
          <Table>
            <THead>
              <tr>
                <Th>Order</Th>
                <Th>Amount</Th>
                <Th>Reason</Th>
                <Th>Case</Th>
                <Th>Status</Th>
                <Th>By</Th>
                <Th>When</Th>
                <Th />
              </tr>
            </THead>
            <TBody>
              {rows.map(({ r, number, customer, isDemo, by, caseNumber }) => (
                <Tr key={r.id}>
                  <Td className="whitespace-nowrap">
                    <Link href={`/admin/orders/${number}`} className="font-medium text-indigo-800 hover:underline">
                      {number}
                    </Link>{" "}
                    <DemoBadge show={isDemo} />
                    <p className="text-xs text-umber-500">{customer}</p>
                  </Td>
                  <Td className="whitespace-nowrap">
                    <OrderAmount amount={r.amount} currency={r.currency} className="font-medium" />
                  </Td>
                  <Td className="max-w-72 text-sm">{r.reason}</Td>
                  <Td>{caseNumber ? <Link href={`/admin/disputes/${caseNumber}`} className="text-indigo-800 hover:underline">{caseNumber}</Link> : "—"}</Td>
                  <Td>
                    <StatusBadge kind="refund" status={r.status} />
                  </Td>
                  <Td className="text-sm">{by ?? "—"}</Td>
                  <Td className="text-xs whitespace-nowrap text-umber-500">{formatDateTime(r.processedAt ?? r.createdAt)}</Td>
                  <Td>{r.status === "requested" ? <ActionButton action={updateRefundStatusAction} fields={{ refundId: r.id, status: "rejected" }} confirm="Reject this refund request?">Reject</ActionButton> : null}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        ) : (
          <Empty>No refunds match.</Empty>
        )}
      </TableCard>
    </div>
  );
}
