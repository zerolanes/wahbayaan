import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import { Mail } from "lucide-react";
import { assignTicketAction, replyTicketAction, setTicketStatusAction } from "@/app/actions/admin/support";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { SelectInput, TextArea, Toggle } from "@/components/admin/controls";
import { AuditTrail, NotesPanel } from "@/components/admin/notes-panel";
import { DetailGrid, KV, OrderAmount, Panel, StatusBadge } from "@/components/admin/ui";
import { Badge, Breadcrumbs, Notice, PageHeader } from "@/components/ui/misc";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { contactMessages, emailOutbox, orders, users } from "@/lib/db/schema";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/lib/commerce/orders";
import { ticketSla } from "@/lib/admin/sla";
import { staffMembers } from "@/lib/admin/staff";
import { formatDateTime, timeAgo } from "@/lib/utils/format";

export const metadata = { title: "Support message" };

export default async function TicketPage(props: PageProps<"/admin/inbox/[id]">) {
  const staff = await requireStaff("support.manage");
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await db();
  const t = await d.query.contactMessages.findFirst({ where: eq(contactMessages.id, id) });
  if (!t) notFound();
  const email = t.email.toLowerCase();
  const [customer, order, recentOrders, emails, others, team] = await Promise.all([
    d.query.users.findFirst({ where: and(eq(sql`lower(${users.email})`, email), eq(users.role, "buyer")) }),
    t.orderNumber ? d.query.orders.findFirst({ where: eq(orders.number, t.orderNumber.trim().toUpperCase()) }) : null,
    d.select().from(orders).where(eq(sql`lower(${orders.email})`, email)).orderBy(desc(orders.createdAt)).limit(5),
    d.select().from(emailOutbox).where(eq(sql`lower(${emailOutbox.to})`, email)).orderBy(desc(emailOutbox.createdAt)).limit(8),
    d.select().from(contactMessages).where(and(eq(sql`lower(${contactMessages.email})`, email), sql`${contactMessages.id} <> ${t.id}`)).orderBy(desc(contactMessages.createdAt)).limit(5),
    staffMembers("support.manage"),
  ]);
  const sla = ticketSla(t);
  const assignee = team.find((s) => s.id === t.assignedToId);

  const main = (
    <>
      {sla.breached ? (
        <Notice tone="danger" title="Past the one-day reply target">
          Received {timeAgo(t.createdAt)} and still unanswered.
        </Notice>
      ) : null}
      <Panel title={t.topic} description={`From ${t.name} <${t.email}> · ${formatDateTime(t.createdAt)}`} action={<StatusBadge kind="ticket" status={t.status} />}>
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-umber-900">{t.message}</p>
        {t.reply ? (
          <div className="mt-5 border-l-2 border-umber-300 pl-4">
            <p className="text-xs font-medium tracking-wide text-umber-500 uppercase">Latest reply</p>
            <p className="mt-1 text-sm whitespace-pre-wrap text-umber-800">{t.reply}</p>
          </div>
        ) : null}
      </Panel>

      <Panel title={t.reply ? "Send another reply" : "Reply by email"} description={`Sent to ${t.email} from the email outbox, with their message quoted below yours.`}>
        <ActionForm action={replyTicketAction} inline resetOnSuccess className="space-y-3">
          <input type="hidden" name="id" value={t.id} />
          <TextArea name="body" rows={7} placeholder={`Hi ${t.name.split(" ")[0]}, …`} aria-label="Reply" required />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Toggle name="resolve" label="Mark resolved after sending" defaultChecked={t.status !== "resolved"} />
            <SubmitButton variant="primary">
              <Mail className="size-3.5" /> Send reply
            </SubmitButton>
          </div>
        </ActionForm>
      </Panel>

      <Panel title="Emails to this address" description="From the email outbox" bodyClassName="p-0">
        {emails.length ? (
          <ul className="divide-y divide-umber-200/60 text-sm">
            {emails.map((e) => (
              <li key={e.id} className="px-5 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-medium text-umber-900">{e.subject}</span>
                  <StatusBadge kind="email" status={e.status} />
                </div>
                <p className="line-clamp-2 text-umber-600">{e.body}</p>
                <p className="text-xs text-umber-400">{formatDateTime(e.createdAt)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-6 text-sm text-umber-500">Nothing sent yet.</p>
        )}
      </Panel>
    </>
  );

  const side = (
    <>
      <Panel title="Handling">
        <KV
          items={[
            ["Status", <StatusBadge key="s" kind="ticket" status={t.status} />],
            ["Age", <Badge key="a" tone={sla.tone} title={sla.note}>{sla.label} · {sla.note}</Badge>],
            ["Assignee", assignee?.name ?? "Unassigned"],
            ["Last update", formatDateTime(t.updatedAt)],
          ]}
        />
        <ActionForm key={t.assignedToId ?? "none"} action={assignTicketAction} className="mt-4 flex gap-2">
          <input type="hidden" name="id" value={t.id} />
          <SelectInput name="assigneeId" defaultValue={t.assignedToId ?? ""} aria-label="Assignee">
            <option value="">Unassigned</option>
            {team.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.id === staff.id ? " (you)" : ""}
              </option>
            ))}
          </SelectInput>
          <SubmitButton>Assign</SubmitButton>
        </ActionForm>
        <div className="mt-3 flex flex-wrap gap-2">
          {t.status !== "resolved" ? (
            <ActionButton action={setTicketStatusAction} fields={{ id: t.id, status: "resolved" }}>
              Mark resolved
            </ActionButton>
          ) : (
            <ActionButton action={setTicketStatusAction} fields={{ id: t.id, status: "open" }}>
              Reopen
            </ActionButton>
          )}
          {t.status === "new" ? (
            <ActionButton action={setTicketStatusAction} fields={{ id: t.id, status: "open" }}>
              Mark open
            </ActionButton>
          ) : null}
        </div>
      </Panel>

      <Panel title="Customer">
        <KV
          items={[
            ["Name", t.name],
            ["Email", <a key="e" href={`mailto:${t.email}`} className="text-indigo-800 hover:underline">{t.email}</a>],
            ["Account", customer ? <Link key="c" href={`/admin/customers/${customer.id}`} className="text-indigo-800 hover:underline">View customer →</Link> : "No account (guest)"],
          ]}
        />
        {t.orderNumber ? (
          <div className="mt-3 rounded-lg border border-umber-200 px-3 py-2 text-sm">
            {order ? (
              <div className="flex items-center justify-between gap-2">
                <Link href={`/admin/orders/${order.number}`} className="font-medium text-indigo-800 hover:underline">
                  {order.number}
                </Link>
                <OrderAmount amount={order.total} currency={order.currency} />
                <Badge tone={ORDER_STATUS_TONE[order.status] ?? "neutral"}>{ORDER_STATUS_LABEL[order.status] ?? order.status}</Badge>
              </div>
            ) : (
              <p className="text-umber-600">
                Mentions order <code>{t.orderNumber}</code> — not found.
              </p>
            )}
          </div>
        ) : null}
        {recentOrders.filter((o) => o.number !== order?.number).length ? (
          <ul className="mt-3 space-y-1 text-sm">
            {recentOrders
              .filter((o) => o.number !== order?.number)
              .map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2">
                  <Link href={`/admin/orders/${o.number}`} className="text-indigo-800 hover:underline">
                    {o.number}
                  </Link>
                  <span className="text-umber-600">
                    <OrderAmount amount={o.total} currency={o.currency} /> · {ORDER_STATUS_LABEL[o.status] ?? o.status}
                  </span>
                </li>
              ))}
          </ul>
        ) : null}
        {others.length ? (
          <div className="mt-4 border-t border-umber-200 pt-3">
            <p className="text-xs font-medium text-umber-500">Earlier messages</p>
            <ul className="mt-1 space-y-1 text-sm">
              {others.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2">
                  <Link href={`/admin/inbox/${o.id}`} className="truncate text-indigo-800 hover:underline">
                    {o.topic}
                  </Link>
                  <span className="shrink-0 text-xs text-umber-500">{timeAgo(o.createdAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Panel>

      <NotesPanel entity="ticket" entityId={t.id} currentUserId={staff.id} />
      <AuditTrail entity="ticket" entityId={t.id} />
    </>
  );

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Support inbox", href: "/admin/inbox" }, { label: t.topic }]} />
      <PageHeader title={t.topic} description={`${t.name} · ${t.email}${t.orderNumber ? ` · order ${t.orderNumber}` : ""}`} />
      <DetailGrid main={main} side={side} />
    </div>
  );
}
