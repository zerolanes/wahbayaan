import Link from "next/link";
import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { Info } from "lucide-react";
import { bulkPayoutsAction, createMissingPayoutsAction } from "@/app/actions/admin/payouts";
import { ActionButton } from "@/components/admin/action-form";
import { BulkBar, RowCheck, SelectAll } from "@/components/admin/bulk";
import { DemoBadge, Empty, ExportLink, MiniStat, Panel, PendingBadge, StatusBadge, TableCard } from "@/components/admin/ui";
import { SellerPrice } from "@/components/money/seller-price";
import { Notice, PageHeader, Pagination, Tabs } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { orders, payouts, vendorOrders, vendors } from "@/lib/db/schema";
import { getSettings } from "@/lib/settings";
import { hrefWith, pageCount, pageOf, str, PAGE_SIZE } from "@/lib/admin/params";
import { formatDate } from "@/lib/utils/format";

export const metadata = { title: "Artisan payouts" };

const TABS = [
  { value: "", label: "To pay", statuses: ["pending", "scheduled"] },
  { value: "on_hold", label: "On hold", statuses: ["on_hold", "failed"] },
  { value: "paid", label: "History", statuses: ["paid"] },
] as const;

export default async function PayoutsPage(props: PageProps<"/admin/payouts">) {
  const user = await requireStaff("payouts.view");
  const params = await props.searchParams;
  const page = pageOf(params);
  const tabValue = str(params, "status");
  const tab = TABS.find((t) => t.value === tabValue) ?? TABS[0];
  const vendorFilter = str(params, "artisan");
  const d = await db();
  const where = and(inArray(payouts.status, [...tab.statuses]), vendorFilter ? eq(payouts.vendorId, vendorFilter) : undefined);
  const [rows, [{ n }], byArtisan, waiting, s, statusTotals] = await Promise.all([
    d
      .select({ p: payouts, name: vendors.displayName, isDemo: vendors.isDemo, bank: vendors.payoutBankName, title: vendors.payoutAccountTitle, last4: vendors.payoutAccountLast4, method: vendors.payoutMethod })
      .from(payouts)
      .innerJoin(vendors, eq(vendors.id, payouts.vendorId))
      .where(where)
      .orderBy(desc(payouts.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    d.select({ n: sql<number>`count(*)::int` }).from(payouts).where(where),
    d
      .select({ vendorId: vendors.id, name: vendors.displayName, total: sql<string>`sum(${payouts.amountPkr})::bigint`, n: sql<number>`count(*)::int`, bank: vendors.payoutBankName, last4: vendors.payoutAccountLast4 })
      .from(payouts)
      .innerJoin(vendors, eq(vendors.id, payouts.vendorId))
      .where(inArray(payouts.status, ["pending", "scheduled"]))
      .groupBy(vendors.id)
      .orderBy(sql`sum(${payouts.amountPkr}) desc`),
    d
      .select({ vo: vendorOrders, number: orders.number, name: vendors.displayName, vendorBps: vendors.commissionBps, releasedAt: orders.releasedAt })
      .from(vendorOrders)
      .innerJoin(orders, eq(orders.id, vendorOrders.orderId))
      .innerJoin(vendors, eq(vendors.id, vendorOrders.vendorId))
      .where(and(eq(orders.fundsState, "released"), isNull(vendorOrders.payoutId), ne(vendorOrders.status, "cancelled"))),
    getSettings(["commission"]),
    d.select({ status: payouts.status, total: sql<string>`sum(${payouts.amountPkr})::bigint`, n: sql<number>`count(*)::int` }).from(payouts).groupBy(payouts.status),
  ]);
  const tot = (st: string) => statusTotals.filter((x) => x.status === st).reduce((a, x) => a + Number(x.total), 0);
  const cnt = (st: string[]) => statusTotals.filter((x) => st.includes(x.status)).reduce((a, x) => a + Number(x.n), 0);
  const canManage = user.permissions.has("payouts.manage");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Orders & money"
        title="Artisan payouts"
        description="Money owed to artisans in PKR after buyer funds are released, net of commission."
        actions={<ExportLink href="/admin/export/payouts">Bank upload CSV</ExportLink>}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniStat label="Pending" value={<SellerPrice pkr={tot("pending")} />} hint={`${cnt(["pending"])} payouts`} />
        <MiniStat label="Scheduled in a batch" value={<SellerPrice pkr={tot("scheduled")} />} hint={`${cnt(["scheduled"])} payouts`} />
        <MiniStat label="On hold / failed" value={<SellerPrice pkr={tot("on_hold") + tot("failed")} />} hint={`${cnt(["on_hold", "failed"])} payouts`} tone={cnt(["on_hold", "failed"]) ? "danger" : undefined} />
        <MiniStat label="Paid to date" value={<SellerPrice pkr={tot("paid")} />} hint={`${cnt(["paid"])} payouts`} />
      </div>

      {waiting.length ? (
        <Notice tone="pending" title={`${waiting.length} released sub-order${waiting.length === 1 ? " is" : "s are"} waiting for a commission rate`} icon={<Info className="size-4" />}>
          <p>
            Buyer funds were released, but no payout could be calculated because the artisan commission is{" "}
            {s.commission.status === "pending" ? "still pending" : "missing for these artisans"}. Set it in{" "}
            <Link href="/admin/rates/fees" className="underline">
              Fees &amp; commission
            </Link>{" "}
            (or as an override on the artisan), then create the payouts.
          </p>
          <ul className="mt-2 space-y-0.5">
            {waiting.slice(0, 8).map((w) => (
              <li key={w.vo.id}>
                <Link href={`/admin/orders/${w.number}`} className="underline">
                  {w.number}
                </Link>{" "}
                · {w.name} · subtotal <SellerPrice pkr={w.vo.subtotalPkr} /> · released {formatDate(w.releasedAt)}
              </li>
            ))}
          </ul>
          {canManage ? (
            <div className="mt-3">
              <ActionButton action={createMissingPayoutsAction} variant="primary">
                Create payouts now
              </ActionButton>
            </div>
          ) : null}
        </Notice>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Panel title="Owed by artisan" description="Pending + scheduled, PKR" bodyClassName="p-0">
          {byArtisan.length ? (
            <ul className="divide-y divide-umber-200/60">
              {byArtisan.map((a) => (
                <li key={a.vendorId} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                  <div>
                    <Link href={hrefWith("/admin/payouts", params, { artisan: a.vendorId })} className="font-medium text-umber-900 hover:text-terracotta-600">
                      {a.name}
                    </Link>
                    <p className="text-xs text-umber-500">
                      {a.bank ? `${a.bank} ····${a.last4 ?? "????"}` : <PendingBadge>No bank details</PendingBadge>} · {a.n} payout{a.n === 1 ? "" : "s"}
                    </p>
                  </div>
                  <SellerPrice pkr={Number(a.total)} className="font-semibold" />
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nothing owed right now.</Empty>
          )}
        </Panel>
        <div className="space-y-3">
          <Tabs items={TABS.map((t) => ({ label: t.label, href: hrefWith("/admin/payouts", params, { status: t.value || null }), active: t === tab, count: cnt([...t.statuses]) }))} />
          {vendorFilter ? (
            <p className="text-sm text-umber-600">
              Filtered to one artisan ·{" "}
              <Link href={hrefWith("/admin/payouts", params, { artisan: null })} className="text-terracotta-600 hover:underline">
                show all
              </Link>
            </p>
          ) : null}
          <TableCard
            toolbar={
              canManage && tab.value !== "paid" ? (
                <BulkBar
                  formId="payouts-bulk"
                  action={bulkPayoutsAction}
                  options={[
                    { value: "schedule", label: "Schedule as a batch" },
                    { value: "paid", label: "Mark paid (enter reference)", confirm: "Mark the selected payouts as paid?" },
                    { value: "hold", label: "Put on hold" },
                    { value: "unhold", label: "Release hold" },
                    { value: "failed", label: "Mark transfer failed" },
                  ]}
                  extra={<input name="reference" placeholder="Bank reference" aria-label="Bank transfer reference" className="h-8 w-40 rounded-full border border-umber-200 bg-white/90 px-3 text-sm focus:border-gold-500 focus:outline-none" />}
                />
              ) : undefined
            }
            footer={<Pagination page={page} pageCount={pageCount(Number(n))} hrefFor={(p) => hrefWith("/admin/payouts", params, { page: p })} />}
          >
            {rows.length ? (
              <Table>
                <THead>
                  <tr>
                    {canManage && tab.value !== "paid" ? (
                      <Th className="w-8">
                        <SelectAll formId="payouts-bulk" />
                      </Th>
                    ) : null}
                    <Th>Artisan</Th>
                    <Th className="text-right">Amount</Th>
                    <Th>Status</Th>
                    <Th>Bank</Th>
                    <Th>Reference</Th>
                    <Th>Notes</Th>
                    <Th>{tab.value === "paid" ? "Paid" : "Created"}</Th>
                  </tr>
                </THead>
                <TBody>
                  {rows.map((r) => (
                    <Tr key={r.p.id}>
                      {canManage && tab.value !== "paid" ? (
                        <Td>
                          <RowCheck formId="payouts-bulk" value={r.p.id} />
                        </Td>
                      ) : null}
                      <Td>
                        <Link href={`/admin/artisans/${r.p.vendorId}`} className="text-umber-900 hover:text-terracotta-600">
                          {r.name}
                        </Link>{" "}
                        <DemoBadge show={r.isDemo} />
                      </Td>
                      <Td className="text-right">
                        <SellerPrice pkr={r.p.amountPkr} className="font-medium" />
                      </Td>
                      <Td>
                        <StatusBadge kind="payout" status={r.p.status} />
                      </Td>
                      <Td className="text-xs text-umber-600">{r.bank ? `${r.title ?? ""} · ${r.bank} ····${r.last4 ?? "????"}` : <PendingBadge>Missing</PendingBadge>}</Td>
                      <Td>
                        <code className="text-xs">{r.p.reference ?? "—"}</code>
                      </Td>
                      <Td className="max-w-48 truncate text-xs text-umber-500">{r.p.notes}</Td>
                      <Td className="text-xs whitespace-nowrap text-umber-500">{formatDate(r.p.paidAt ?? r.p.createdAt)}</Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            ) : (
              <Empty>No payouts here.</Empty>
            )}
          </TableCard>
        </div>
      </div>
    </div>
  );
}
