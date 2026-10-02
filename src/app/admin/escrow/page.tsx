import Link from "next/link";
import { and, desc, eq, gte, sql, type SQL } from "drizzle-orm";
import { runAutoReleasesAction } from "@/app/actions/admin/escrow";
import { ActionButton } from "@/components/admin/action-form";
import { DemoBadge, Empty, ExportLink, FilterBar, FilterSelect, MiniStat, OrderAmount, Panel, StatusBadge, TableCard } from "@/components/admin/ui";
import { Badge, Notice, PageHeader, Pagination } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { orders, payments } from "@/lib/db/schema";
import { activeProvider } from "@/lib/payments";
import { ORDER_STATUS_LABEL } from "@/lib/commerce/orders";
import { orderMoney, sumByCurrency } from "@/lib/admin/money";
import { hrefWith, pageCount, pageOf, str, PAGE_SIZE } from "@/lib/admin/params";
import { formatDateTime, timeAgo } from "@/lib/utils/format";

export const metadata = { title: "Escrow & payments" };

export default async function EscrowPage(props: PageProps<"/admin/escrow">) {
  await requireStaff("escrow.release");
  const params = await props.searchParams;
  const page = pageOf(params);
  const d = await db();
  const now = new Date();
  const payConds: SQL[] = [];
  if (str(params, "mode")) payConds.push(eq(payments.mode, str(params, "mode")));
  if (str(params, "pstatus")) payConds.push(sql`${payments.status} = ${str(params, "pstatus")}`);
  if (str(params, "q")) payConds.push(sql`(${payments.providerRef} ilike ${"%" + str(params, "q") + "%"} or ${orders.number} ilike ${"%" + str(params, "q") + "%"})`);

  const [held, frozen, released30, payRows, [{ n: payTotal }]] = await Promise.all([
    d.select().from(orders).where(eq(orders.fundsState, "held")).orderBy(orders.autoReleaseAt),
    d.query.orders.findMany({ where: eq(orders.fundsState, "frozen"), with: { disputes: true } }),
    d.select().from(orders).where(and(eq(orders.fundsState, "released"), gte(orders.releasedAt, new Date(Date.now() - 30 * 86_400_000)))),
    d
      .select({ p: payments, number: orders.number, isDemo: orders.isDemo })
      .from(payments)
      .innerJoin(orders, eq(orders.id, payments.orderId))
      .where(and(...payConds))
      .orderBy(desc(payments.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    d.select({ n: sql<number>`count(*)::int` }).from(payments).innerJoin(orders, eq(orders.id, payments.orderId)).where(and(...payConds)),
  ]);
  const due = held.filter((o) => o.status === "delivered" && o.autoReleaseAt && o.autoReleaseAt < now);
  const upcoming = held.filter((o) => o.status === "delivered" && o.autoReleaseAt && o.autoReleaseAt >= now);
  const inProgress = held.filter((o) => o.status !== "delivered");
  const provider = activeProvider();
  const heldSums = sumByCurrency(held, (o) => o.currency, (o) => o.total);
  const frozenSums = sumByCurrency(frozen, (o) => o.currency, (o) => o.total);
  const relSums = sumByCurrency(released30, (o) => o.currency, (o) => o.total);

  const orderRow = (o: typeof orders.$inferSelect, extra?: React.ReactNode) => (
    <li key={o.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
      <div className="min-w-0">
        <p className="flex items-center gap-1.5">
          <Link href={`/admin/orders/${o.number}`} className="font-medium text-indigo-800 hover:underline">
            {o.number}
          </Link>
          <DemoBadge show={o.isDemo} />
          <span className="truncate text-umber-500">· {o.customerName}</span>
        </p>
        <p className="text-xs text-umber-500">
          {ORDER_STATUS_LABEL[o.status] ?? o.status} {extra ? <>· {extra}</> : null}
        </p>
      </div>
      <OrderAmount amount={o.total} currency={o.currency} className="shrink-0 font-medium" />
    </li>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Orders & money"
        title="Escrow & payments"
        description="Buyer payments are held by Wahbayaan until delivery, then released to artisans. Frozen funds belong to orders with an open case."
        actions={<ActionButton action={runAutoReleasesAction} variant="primary" size="md" confirm={`Release funds on ${due.length} order(s) whose protection window has ended?`}>Run auto-release now ({due.length} due)</ActionButton>}
      />
      {provider.mode !== "live" ? (
        <Notice tone="pending" title={provider.id === "test" ? "Test payment simulator active — no real money moves" : "Stripe is in test mode"}>
          Payments below marked “test” are simulated. Connect live Stripe keys before launch (see System health).
        </Notice>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat label={`Held · ${held.length} orders`} value={heldSums.length ? heldSums.map((s) => orderMoney(s.total, s.currency)).join(" · ") : "—"} />
        <MiniStat label={`Frozen · ${frozen.length} orders`} value={frozenSums.length ? frozenSums.map((s) => orderMoney(s.total, s.currency)).join(" · ") : "—"} tone={frozen.length ? "danger" : undefined} />
        <MiniStat label="Due for auto-release" value={due.length} hint="Delivered, protection window ended" tone={due.length ? "pending" : undefined} />
        <MiniStat label="Released, last 30 days" value={relSums.length ? relSums.map((s) => orderMoney(s.total, s.currency)).join(" · ") : "—"} hint={`${released30.length} orders`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Due for auto-release" description="The buyer didn't confirm or open a case within the window." bodyClassName="p-0">
          {due.length ? (
            <ul className="divide-y divide-umber-200/60">{due.map((o) => orderRow(o, `due ${timeAgo(o.autoReleaseAt!)}`))}</ul>
          ) : (
            <Empty>Nothing is due.</Empty>
          )}
        </Panel>
        <Panel title="Upcoming releases" description="Delivered orders still inside the buyer-protection window." bodyClassName="p-0">
          {upcoming.length ? (
            <ul className="divide-y divide-umber-200/60">{upcoming.map((o) => orderRow(o, `releases ${formatDateTime(o.autoReleaseAt)}`))}</ul>
          ) : (
            <Empty>No delivered orders waiting.</Empty>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Held — not yet delivered" description="Being made, packed or in transit." bodyClassName="p-0">
          {inProgress.length ? (
            <ul className="divide-y divide-umber-200/60">{inProgress.map((o) => orderRow(o, o.paidAt ? `paid ${timeAgo(o.paidAt)}` : ""))}</ul>
          ) : (
            <Empty>No held orders in progress.</Empty>
          )}
        </Panel>
        <Panel title="Frozen funds" description="Released or refunded when the case is resolved." bodyClassName="p-0">
          {frozen.length ? (
            <ul className="divide-y divide-umber-200/60">
                {frozen.map((o) =>
                  orderRow(
                    o,
                    o.disputes.filter((x) => !["resolved", "closed"].includes(x.status)).map((x) => (
                      <Link key={x.id} href={`/admin/disputes/${x.number}`} className="text-danger-700 underline underline-offset-2">
                        {x.number}
                      </Link>
                    )),
                  ),
                )}
              </ul>
          ) : (
            <Empty>No frozen funds.</Empty>
          )}
        </Panel>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold tracking-wider text-umber-500 uppercase">Payments</h2>
        <FilterBar action="/admin/escrow" q={str(params, "q")} placeholder="Order number or provider reference" extra={<ExportLink href={hrefWith("/admin/export/payments", params, {})} />}>
          <FilterSelect name="mode" label="Mode" value={str(params, "mode")} options={["test", "live", "manual"].map((m) => ({ value: m, label: m }))} />
          <FilterSelect name="pstatus" label="Status" value={str(params, "pstatus")} options={["pending", "succeeded", "failed", "refunded"].map((m) => ({ value: m, label: m }))} />
        </FilterBar>
        <TableCard footer={<Pagination page={page} pageCount={pageCount(Number(payTotal))} hrefFor={(p) => hrefWith("/admin/escrow", params, { page: p })} />}>
          {payRows.length ? (
            <Table>
              <THead>
                <tr>
                  <Th>Order</Th>
                  <Th>Provider</Th>
                  <Th>Mode</Th>
                  <Th>Reference</Th>
                  <Th className="text-right">Amount</Th>
                  <Th>Status</Th>
                  <Th>When</Th>
                </tr>
              </THead>
              <TBody>
                {payRows.map(({ p, number, isDemo }) => (
                  <Tr key={p.id}>
                    <Td className="whitespace-nowrap">
                      <Link href={`/admin/orders/${number}`} className="text-indigo-800 hover:underline">
                        {number}
                      </Link>{" "}
                      <DemoBadge show={isDemo} />
                    </Td>
                    <Td>{p.provider}</Td>
                    <Td>
                      <Badge tone={p.mode === "live" ? "success" : p.mode === "test" ? "pending" : "neutral"}>{p.mode === "test" ? "Test" : p.mode}</Badge>
                    </Td>
                    <Td>
                      <code className="text-xs">{p.providerRef ?? "—"}</code>
                    </Td>
                    <Td className="text-right whitespace-nowrap">
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
            <Empty>No payments match.</Empty>
          )}
        </TableCard>
      </section>
    </div>
  );
}
