import Link from "next/link";
import { and, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { bulkDisputesAction } from "@/app/actions/admin/disputes";
import { BulkBar, RowCheck, SelectAll } from "@/components/admin/bulk";
import { DemoBadge, Empty, FilterBar, FilterSelect, OrderAmount, StatusBadge, TableCard } from "@/components/admin/ui";
import { Badge, PageHeader, Pagination, Tabs } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { disputeMessages, disputes, orders, users } from "@/lib/db/schema";
import { DISPUTE_REASON_LABEL } from "@/lib/admin/labels";
import { hrefWith, pageCount, pageOf, str, PAGE_SIZE } from "@/lib/admin/params";
import { disputeSla } from "@/lib/admin/sla";
import { likeTerm } from "@/lib/admin/sql";
import { staffMembers } from "@/lib/admin/staff";
import { timeAgo } from "@/lib/utils/format";

export const metadata = { title: "Disputes" };

const TABS = [
  { value: "", label: "Open" },
  { value: "open", label: "New" },
  { value: "awaiting_seller", label: "Awaiting artisan" },
  { value: "awaiting_buyer", label: "Awaiting buyer" },
  { value: "under_review", label: "Under review" },
  { value: "resolved", label: "Resolved" },
  { value: "all", label: "All" },
];

export default async function DisputesPage(props: PageProps<"/admin/disputes">) {
  const user = await requireStaff("disputes.view");
  const params = await props.searchParams;
  const page = pageOf(params);
  const tab = str(params, "status");
  const d = await db();
  const base: SQL[] = [];
  const q = str(params, "q");
  if (q) base.push(or(ilike(disputes.number, likeTerm(q)), ilike(orders.number, likeTerm(q)), ilike(orders.customerName, likeTerm(q)), ilike(orders.email, likeTerm(q)))!);
  if (str(params, "reason")) base.push(sql`${disputes.reason} = ${str(params, "reason")}`);
  const assignee = str(params, "assignee");
  if (assignee === "me") base.push(eq(disputes.assignedToId, user.id));
  else if (assignee === "none") base.push(isNull(disputes.assignedToId));
  else if (assignee) base.push(eq(disputes.assignedToId, assignee));
  const statusCond = !tab ? sql`${disputes.status} not in ('resolved','closed')` : tab === "all" ? undefined : tab === "resolved" ? sql`${disputes.status} in ('resolved','closed')` : sql`${disputes.status} = ${tab}`;
  const where = and(...base, ...(statusCond ? [statusCond] : []));

  const [rows, [{ n }], counts, staff] = await Promise.all([
    d
      .select({ x: disputes, number: orders.number, customer: orders.customerName, total: orders.total, currency: orders.currency, fundsState: orders.fundsState, isDemo: orders.isDemo, assignee: users.name })
      .from(disputes)
      .innerJoin(orders, eq(orders.id, disputes.orderId))
      .leftJoin(users, eq(users.id, disputes.assignedToId))
      .where(where)
      .orderBy(desc(disputes.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    d.select({ n: sql<number>`count(*)::int` }).from(disputes).innerJoin(orders, eq(orders.id, disputes.orderId)).where(where),
    d.select({ status: disputes.status, n: sql<number>`count(*)::int` }).from(disputes).innerJoin(orders, eq(orders.id, disputes.orderId)).where(and(...base)).groupBy(disputes.status),
    staffMembers("disputes.view"),
  ]);
  const ids = rows.map((r) => r.x.id);
  const msgs = ids.length
    ? await d.select({ disputeId: disputeMessages.disputeId, role: disputeMessages.authorRole, at: disputeMessages.createdAt }).from(disputeMessages).where(inArray(disputeMessages.disputeId, ids))
    : [];
  const count = (s: string) => {
    const by = Object.fromEntries(counts.map((c) => [c.status, Number(c.n)]));
    if (s === "") return counts.filter((c) => !["resolved", "closed"].includes(c.status)).reduce((a, c) => a + Number(c.n), 0);
    if (s === "all") return counts.reduce((a, c) => a + Number(c.n), 0);
    if (s === "resolved") return (by.resolved ?? 0) + (by.closed ?? 0);
    return by[s] ?? 0;
  };

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Orders & money" title="Disputes" description="Buyer cases with frozen funds. Target: first staff reply within 24 hours, resolution within 5 days." />
      <Tabs items={TABS.map((t) => ({ label: t.label, href: hrefWith("/admin/disputes", params, { status: t.value || null }), active: tab === t.value, count: count(t.value) }))} />
      <FilterBar action="/admin/disputes" q={q} placeholder="Case, order number, buyer name or email">
        {tab ? <input type="hidden" name="status" value={tab} /> : null}
        <FilterSelect name="reason" label="Reason" value={str(params, "reason")} options={Object.entries(DISPUTE_REASON_LABEL).map(([value, label]) => ({ value, label }))} />
        <FilterSelect name="assignee" label="Assignee" value={assignee} options={[{ value: "me", label: "Me" }, { value: "none", label: "Unassigned" }, ...staff.map((s) => ({ value: s.id, label: s.name }))]} />
      </FilterBar>
      <TableCard
        toolbar={
          <>
            <p className="text-sm text-umber-600">{Number(n)} case{Number(n) === 1 ? "" : "s"}</p>
            <BulkBar
              formId="disputes-bulk"
              action={bulkDisputesAction}
              options={[
                { value: "assign_me", label: "Assign to me" },
                { value: "under_review", label: "Mark under review" },
              ]}
            />
          </>
        }
        footer={<Pagination page={page} pageCount={pageCount(Number(n))} hrefFor={(p) => hrefWith("/admin/disputes", params, { page: p })} />}
      >
        {rows.length ? (
          <Table>
            <THead>
              <tr>
                <Th className="w-8">
                  <SelectAll formId="disputes-bulk" />
                </Th>
                <Th>Case</Th>
                <Th>Order</Th>
                <Th>Reason</Th>
                <Th>Status</Th>
                <Th>Age / SLA</Th>
                <Th>Assignee</Th>
                <Th>Last message</Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => {
                const m = msgs.filter((x) => x.disputeId === r.x.id).sort((a, b) => +b.at - +a.at);
                const sla = disputeSla({ createdAt: r.x.createdAt, resolvedAt: r.x.resolvedAt, status: r.x.status, staffReplied: m.some((x) => x.role === "staff") });
                return (
                  <Tr key={r.x.id}>
                    <Td>
                      <RowCheck formId="disputes-bulk" value={r.x.id} />
                    </Td>
                    <Td className="whitespace-nowrap">
                      <Link href={`/admin/disputes/${r.x.number}`} className="font-medium text-indigo-800 hover:underline">
                        {r.x.number}
                      </Link>{" "}
                      <DemoBadge show={r.isDemo} />
                    </Td>
                    <Td>
                      <Link href={`/admin/orders/${r.number}`} className="text-umber-800 hover:underline">
                        {r.number}
                      </Link>
                      <p className="text-xs text-umber-500">
                        {r.customer} · <OrderAmount amount={r.total} currency={r.currency} />
                      </p>
                    </Td>
                    <Td>{DISPUTE_REASON_LABEL[r.x.reason]}</Td>
                    <Td>
                      <StatusBadge kind="dispute" status={r.x.status} />
                    </Td>
                    <Td>
                      <Badge tone={sla.tone} title={sla.note}>
                        {sla.label}
                      </Badge>
                      <p className="mt-0.5 text-xs text-umber-500">{sla.note}</p>
                    </Td>
                    <Td className="text-sm">{r.assignee ?? <span className="text-umber-400">Unassigned</span>}</Td>
                    <Td className="text-xs text-umber-500">{m[0] ? `${m[0].role} · ${timeAgo(m[0].at)}` : "—"}</Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        ) : (
          <Empty>No cases here.</Empty>
        )}
      </TableCard>
    </div>
  );
}
