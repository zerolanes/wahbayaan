import Link from "next/link";
import { and, asc, desc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { bulkTicketsAction } from "@/app/actions/admin/support";
import { BulkBar, RowCheck, SelectAll } from "@/components/admin/bulk";
import { Empty, FilterBar, FilterSelect, MiniStat, StatusBadge, TableCard } from "@/components/admin/ui";
import { Badge, PageHeader, Pagination, Tabs } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { contactMessages, users } from "@/lib/db/schema";
import { hrefWith, pageCount, pageOf, str, PAGE_SIZE } from "@/lib/admin/params";
import { ticketSla } from "@/lib/admin/sla";
import { likeTerm } from "@/lib/admin/sql";
import { staffMembers } from "@/lib/admin/staff";
import { formatDateTime } from "@/lib/utils/format";

export const metadata = { title: "Support inbox" };

const TABS = [
  { value: "", label: "All" },
  { value: "new", label: "New" },
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
];

export default async function InboxPage(props: PageProps<"/admin/inbox">) {
  const user = await requireStaff("support.manage");
  const params = await props.searchParams;
  const page = pageOf(params);
  const status = str(params, "status");
  const d = await db();
  const base: SQL[] = [];
  const q = str(params, "q");
  if (q) base.push(or(ilike(contactMessages.email, likeTerm(q)), ilike(contactMessages.name, likeTerm(q)), ilike(contactMessages.message, likeTerm(q)), ilike(contactMessages.orderNumber, likeTerm(q)))!);
  if (str(params, "topic")) base.push(eq(contactMessages.topic, str(params, "topic")));
  const assignee = str(params, "assignee");
  if (assignee === "me") base.push(eq(contactMessages.assignedToId, user.id));
  else if (assignee === "none") base.push(isNull(contactMessages.assignedToId));
  else if (/^[0-9a-f-]{36}$/i.test(assignee)) base.push(eq(contactMessages.assignedToId, assignee));
  const where = and(...base, ...(status ? [sql`${contactMessages.status} = ${status}`] : []));
  const [rows, [{ n }], counts, topics, staff, [stats]] = await Promise.all([
    d
      .select({ t: contactMessages, assignee: users.name, customerId: sql<string | null>`(select u.id from users u where lower(u.email) = lower("contact_messages"."email") and u.role = 'buyer' limit 1)` })
      .from(contactMessages)
      .leftJoin(users, eq(users.id, contactMessages.assignedToId))
      .where(where)
      .orderBy(status === "resolved" ? desc(contactMessages.updatedAt) : sql`case ${contactMessages.status} when 'new' then 0 when 'open' then 1 else 2 end`, status === "resolved" ? desc(contactMessages.createdAt) : asc(contactMessages.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    d.select({ n: sql<number>`count(*)::int` }).from(contactMessages).where(where),
    d.select({ s: contactMessages.status, n: sql<number>`count(*)::int` }).from(contactMessages).where(and(...base)).groupBy(contactMessages.status),
    d.selectDistinct({ topic: contactMessages.topic }).from(contactMessages).orderBy(asc(contactMessages.topic)),
    staffMembers("support.manage"),
    d
      .select({
        unassigned: sql<number>`count(*) filter (where ${contactMessages.assignedToId} is null and ${contactMessages.status} <> 'resolved')::int`,
        overdue: sql<number>`count(*) filter (where ${contactMessages.status} = 'new' and ${contactMessages.createdAt} < now() - interval '24 hours')::int`,
        mine: sql<number>`count(*) filter (where ${contactMessages.assignedToId} = ${user.id} and ${contactMessages.status} <> 'resolved')::int`,
        resolved30: sql<number>`count(*) filter (where ${contactMessages.status} = 'resolved' and ${contactMessages.updatedAt} >= now() - interval '30 days')::int`,
      })
      .from(contactMessages),
  ]);
  const c = Object.fromEntries(counts.map((x) => [x.s, Number(x.n)])) as Record<string, number>;
  const total = Number(n);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Customers" title="Support inbox" description="Messages from the contact form. Replies go out by email from the outbox and are recorded on the message; aim to answer within a day." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="New" value={String(c.new ?? 0)} hint="Waiting for a first reply" href="/admin/inbox?status=new" />
        <MiniStat label="Past 24h without reply" value={String(stats.overdue)} tone={stats.overdue ? "danger" : undefined} hint="Service target: 1 day" href="/admin/inbox?status=new" />
        <MiniStat label="Unassigned" value={String(stats.unassigned)} hint={`${stats.mine} assigned to you`} href="/admin/inbox?assignee=none" />
        <MiniStat label="Resolved · 30 days" value={String(stats.resolved30)} href="/admin/inbox?status=resolved" />
      </div>
      <Tabs items={TABS.map((t) => ({ label: t.label, href: hrefWith("/admin/inbox", params, { status: t.value || null }), active: status === t.value, count: t.value ? (c[t.value] ?? 0) : Object.values(c).reduce((a, b) => a + b, 0) }))} />
      <FilterBar action="/admin/inbox" q={q} placeholder="Name, email, order or text">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <FilterSelect name="topic" label="Topic" value={str(params, "topic")} options={topics.map((t) => ({ value: t.topic, label: t.topic }))} />
        <FilterSelect name="assignee" label="Assignee" value={assignee} options={[{ value: "me", label: "Me" }, { value: "none", label: "Unassigned" }, ...staff.filter((s) => s.id !== user.id).map((s) => ({ value: s.id, label: s.name }))]} />
      </FilterBar>
      <TableCard
        toolbar={
          <>
            <p className="text-sm text-umber-600">
              {total} message{total === 1 ? "" : "s"}
            </p>
            <BulkBar
              formId="inbox-bulk"
              action={bulkTicketsAction}
              options={[
                { value: "assign_me", label: "Assign to me" },
                { value: "resolve", label: "Mark resolved" },
                { value: "reopen", label: "Reopen" },
              ]}
            />
          </>
        }
        footer={<Pagination page={page} pageCount={pageCount(total)} hrefFor={(p) => hrefWith("/admin/inbox", params, { page: p })} />}
      >
        {rows.length ? (
          <Table>
            <THead>
              <tr>
                <Th className="w-8">
                  <SelectAll formId="inbox-bulk" />
                </Th>
                <Th>From</Th>
                <Th>Message</Th>
                <Th>Assignee</Th>
                <Th>Age</Th>
                <Th>Status</Th>
              </tr>
            </THead>
            <TBody>
              {rows.map(({ t, assignee: who, customerId }) => {
                const sla = ticketSla(t);
                return (
                  <Tr key={t.id}>
                    <Td>
                      <RowCheck formId="inbox-bulk" value={t.id} label={`Select message from ${t.email}`} />
                    </Td>
                    <Td className="max-w-52">
                      <p className="truncate font-medium text-umber-900">{t.name}</p>
                      <p className="truncate text-xs text-umber-500">
                        {customerId ? (
                          <Link href={`/admin/customers/${customerId}`} className="hover:underline">
                            {t.email}
                          </Link>
                        ) : (
                          t.email
                        )}
                      </p>
                    </Td>
                    <Td className="max-w-md">
                      <Link href={`/admin/inbox/${t.id}`} className="font-medium text-indigo-800 hover:underline">
                        {t.topic}
                      </Link>
                      {t.orderNumber ? <span className="ml-1.5 text-xs text-umber-500">· {t.orderNumber}</span> : null}
                      <p className="truncate text-sm text-umber-600">{t.message}</p>
                    </Td>
                    <Td className="text-sm whitespace-nowrap text-umber-700">{who ?? <span className="text-umber-400">Unassigned</span>}</Td>
                    <Td className="whitespace-nowrap">
                      <Badge tone={sla.tone} title={`${sla.note} · received ${formatDateTime(t.createdAt)}`}>
                        {sla.label}
                      </Badge>
                    </Td>
                    <Td>
                      <StatusBadge kind="ticket" status={t.status} />
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        ) : (
          <Empty>{status === "new" ? "Inbox zero — no new messages." : "No messages match these filters."}</Empty>
        )}
      </TableCard>
    </div>
  );
}
