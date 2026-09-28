import Link from "next/link";
import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { Flag, ShieldAlert } from "lucide-react";
import { Empty, FilterBar, FilterSelect, MiniStat, TableCard } from "@/components/admin/ui";
import { Badge, PageHeader, Pagination } from "@/components/ui/misc";
import { TBody, THead, Table, Td, Th, Tr } from "@/components/ui/table";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { conversations, messages, products, users, vendors } from "@/lib/db/schema";
import { CONTACT_SQL_REGEX, detectContactDetails } from "@/lib/admin/moderation";
import { hrefWith, pageCount, pageOf, str, PAGE_SIZE } from "@/lib/admin/params";
import { likeTerm } from "@/lib/admin/sql";
import { timeAgo } from "@/lib/utils/format";

export const metadata = { title: "Conversations" };

const CID = sql.raw(`"conversations"."id"`);
const flaggedSql = sql<boolean>`exists (select 1 from admin_notes n where n.entity = 'conversation_flag' and n.entity_id = ${CID}::text)`;
const contactSql = sql<boolean>`exists (select 1 from messages m where m.conversation_id = ${CID} and m.body ~* ${CONTACT_SQL_REGEX})`;

export default async function ConversationsPage(props: PageProps<"/admin/conversations">) {
  await requireStaff("support.manage");
  const params = await props.searchParams;
  const page = pageOf(params);
  const d = await db();
  const cond: SQL[] = [];
  const q = str(params, "q");
  if (q) cond.push(or(ilike(conversations.subject, likeTerm(q)), ilike(users.name, likeTerm(q)), ilike(users.email, likeTerm(q)), ilike(vendors.displayName, likeTerm(q)))!);
  if (str(params, "artisan")) cond.push(eq(conversations.vendorId, str(params, "artisan")));
  if (str(params, "flagged") === "1") cond.push(flaggedSql);
  if (str(params, "contact") === "1") cond.push(contactSql);
  if (str(params, "active") === "7") cond.push(sql`${conversations.lastMessageAt} >= now() - interval '7 days'`);
  const where = and(...cond);
  const from = () =>
    d
      .select({
        c: conversations,
        buyer: users.name,
        buyerEmail: users.email,
        vendor: vendors.displayName,
        product: products.title,
        flagged: flaggedSql,
        n: sql<number>`(select count(*)::int from messages m where m.conversation_id = ${CID})`,
      })
      .from(conversations)
      .innerJoin(users, eq(users.id, conversations.buyerId))
      .innerJoin(vendors, eq(vendors.id, conversations.vendorId))
      .leftJoin(products, eq(products.id, conversations.productId));
  const [rows, [{ n: total }], artisans, [stats]] = await Promise.all([
    from()
      .where(where)
      .orderBy(desc(conversations.lastMessageAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    d
      .select({ n: sql<number>`count(*)::int` })
      .from(conversations)
      .innerJoin(users, eq(users.id, conversations.buyerId))
      .innerJoin(vendors, eq(vendors.id, conversations.vendorId))
      .where(where),
    d.select({ id: vendors.id, name: vendors.displayName }).from(vendors).orderBy(asc(vendors.displayName)),
    d
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${conversations.lastMessageAt} >= now() - interval '7 days')::int`,
        flagged: sql<number>`count(*) filter (where ${flaggedSql})::int`,
        contact: sql<number>`count(*) filter (where ${contactSql})::int`,
      })
      .from(conversations),
  ]);
  const msgs = rows.length
    ? await d
        .select({ conversationId: messages.conversationId, body: messages.body, senderUserId: messages.senderUserId, createdAt: messages.createdAt })
        .from(messages)
        .where(inArray(messages.conversationId, rows.map((r) => r.c.id)))
        .orderBy(desc(messages.createdAt))
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Customers"
        title="Conversations"
        description="Read-only monitor of buyer ↔ artisan messages. Watch for attempts to move the sale off-platform — that removes buyer protection and escrow — and redact contact details."
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="Conversations" value={String(stats.total)} />
        <MiniStat label="Active · 7 days" value={String(stats.active)} href="/admin/conversations?active=7" />
        <MiniStat label="Share contact details" value={String(stats.contact)} tone={stats.contact ? "danger" : undefined} hint="Emails, phone numbers, links, apps" href="/admin/conversations?contact=1" />
        <MiniStat label="Flagged" value={String(stats.flagged)} href="/admin/conversations?flagged=1" />
      </div>
      <FilterBar action="/admin/conversations" q={q} placeholder="Subject, buyer or artisan">
        <FilterSelect name="artisan" label="Artisan" value={str(params, "artisan")} options={artisans.map((a) => ({ value: a.id, label: a.name }))} />
        <FilterSelect name="contact" label="Contact details" value={str(params, "contact")} options={[{ value: "1", label: "Detected" }]} />
        <FilterSelect name="flagged" label="Flag" value={str(params, "flagged")} options={[{ value: "1", label: "Flagged" }]} />
        <FilterSelect name="active" label="Activity" value={str(params, "active")} options={[{ value: "7", label: "Last 7 days" }]} />
      </FilterBar>
      <TableCard
        toolbar={<p className="text-sm text-umber-600">{Number(total)} conversation{Number(total) === 1 ? "" : "s"}</p>}
        footer={<Pagination page={page} pageCount={pageCount(Number(total))} hrefFor={(p) => hrefWith("/admin/conversations", params, { page: p })} />}
      >
        {rows.length ? (
          <Table>
            <THead>
              <tr>
                <Th>Conversation</Th>
                <Th>Buyer</Th>
                <Th>Artisan</Th>
                <Th className="text-right">Messages</Th>
                <Th>Last message</Th>
                <Th>Signals</Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => {
                const thread = msgs.filter((m) => m.conversationId === r.c.id);
                const hits = thread.flatMap((m) => detectContactDetails(m.body));
                const last = thread[0];
                return (
                  <Tr key={r.c.id}>
                    <Td className="max-w-sm">
                      <Link href={`/admin/conversations/${r.c.id}`} className="font-medium text-indigo-800 hover:underline">
                        {r.c.subject}
                      </Link>
                      <p className="truncate text-xs text-umber-500">{r.product ? `About ${r.product}` : "General enquiry"}</p>
                    </Td>
                    <Td className="text-sm">
                      <Link href={`/admin/customers/${r.c.buyerId}`} className="text-umber-900 hover:underline">
                        {r.buyer}
                      </Link>
                    </Td>
                    <Td className="text-sm">
                      <Link href={`/admin/artisans/${r.c.vendorId}`} className="text-umber-900 hover:underline">
                        {r.vendor}
                      </Link>
                    </Td>
                    <Td className="text-right tabular-nums">{r.n}</Td>
                    <Td className="max-w-xs">
                      <p className="truncate text-sm text-umber-700">{last ? `${last.senderUserId === r.c.buyerId ? "Buyer" : "Artisan"}: ${last.body}` : "—"}</p>
                      <p className="text-xs text-umber-500">{timeAgo(r.c.lastMessageAt)}</p>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {hits.length ? (
                          <Badge tone="danger">
                            <ShieldAlert className="size-3" />
                            {hits.length} contact detail{hits.length === 1 ? "" : "s"}
                          </Badge>
                        ) : null}
                        {r.flagged ? (
                          <Badge tone="warning">
                            <Flag className="size-3" />
                            Flagged
                          </Badge>
                        ) : null}
                        {!hits.length && !r.flagged ? <span className="text-xs text-umber-400">—</span> : null}
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        ) : (
          <Empty>No conversations match these filters.</Empty>
        )}
      </TableCard>
    </div>
  );
}
