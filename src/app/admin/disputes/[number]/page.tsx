import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq, inArray } from "drizzle-orm";
import { assignDisputeAction, replyDisputeAction, resolveDisputeAction, setDisputeStatusAction } from "@/app/actions/admin/disputes";
import { ActionForm, SubmitButton } from "@/components/admin/action-form";
import { FieldRow, SelectInput, TextArea, TextInput, Toggle } from "@/components/admin/controls";
import { AuditTrail, NotesPanel } from "@/components/admin/notes-panel";
import { DemoBadge, DetailGrid, KV, OrderAmount, Panel, StatusBadge } from "@/components/admin/ui";
import { Badge, Breadcrumbs, Notice, PageHeader } from "@/components/ui/misc";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { disputeMessages, disputes, users } from "@/lib/db/schema";
import { ORDER_STATUS_LABEL } from "@/lib/commerce/orders";
import { DISPUTE_REASON_LABEL } from "@/lib/admin/labels";
import { orderMoney } from "@/lib/admin/money";
import { disputeSla } from "@/lib/admin/sla";
import { staffMembers } from "@/lib/admin/staff";
import { cn } from "@/lib/utils/cn";
import { formatDateTime, timeAgo } from "@/lib/utils/format";

export async function generateMetadata(props: PageProps<"/admin/disputes/[number]">) {
  const { number } = await props.params;
  return { title: `Case ${number}` };
}

export default async function DisputeDetail(props: PageProps<"/admin/disputes/[number]">) {
  const user = await requireStaff("disputes.view");
  const { number } = await props.params;
  const d = await db();
  const x = await d.query.disputes.findFirst({
    where: eq(disputes.number, decodeURIComponent(number)),
    with: { order: { with: { refunds: true } }, vendorOrder: { with: { vendor: true, items: true } }, messages: { orderBy: asc(disputeMessages.createdAt) } },
  });
  if (!x) notFound();
  const authorIds = [...new Set(x.messages.map((m) => m.authorUserId).filter((v): v is string => !!v))];
  const authors = authorIds.length ? await d.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, authorIds)) : [];
  const staff = await staffMembers("disputes.view");
  const o = x.order;
  const closed = ["resolved", "closed"].includes(x.status);
  const sla = disputeSla({ createdAt: x.createdAt, resolvedAt: x.resolvedAt, status: x.status, staffReplied: x.messages.some((m) => m.authorRole === "staff") });
  const refunded = o.refunds.filter((r) => r.status === "processed").reduce((a, r) => a + r.amount, 0);
  const canResolve = user.permissions.has("disputes.resolve");

  const main = (
    <>
      {closed ? (
        <Notice tone="success" title={`Resolved: ${x.resolution?.replace("_", " ") ?? "closed"}`}>
          {x.resolutionNote} {x.resolvedAt ? `· ${formatDateTime(x.resolvedAt)}` : ""}
        </Notice>
      ) : (
        <Notice tone={sla.breached ? "danger" : "pending"} title={`Open for ${sla.label} — ${sla.note}`}>
          Funds on {o.number} are {o.fundsState}. Resolving releases or refunds them.
        </Notice>
      )}
      <Panel title="The buyer's report">
        <KV
          items={[
            ["Reason", DISPUTE_REASON_LABEL[x.reason]],
            ["Wants", x.desiredOutcome?.replace(/_/g, " ") ?? "—"],
            ["Parcel", x.vendorOrder ? <Link key="v" href={`/admin/artisans/${x.vendorOrder.vendorId}`} className="text-indigo-800 hover:underline">{x.vendorOrder.vendor.displayName}</Link> : "Whole order"],
            ["Opened", formatDateTime(x.createdAt)],
          ]}
        />
        <p className="mt-4 rounded-xl bg-sand-100 px-4 py-3 text-sm whitespace-pre-wrap text-umber-800">{x.description}</p>
        {x.evidenceUrls.length ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold tracking-wide text-umber-500 uppercase">Evidence ({x.evidenceUrls.length})</p>
            <div className="flex flex-wrap gap-3">
              {x.evidenceUrls.map((u) => (
                <a key={u} href={u} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl ring-1 ring-umber-200 hover:ring-gold-400">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="Buyer evidence photo" className="size-32 object-cover" />
                </a>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-umber-500">No photos attached.</p>
        )}
      </Panel>

      <Panel title={`Conversation (${x.messages.length})`} description="Staff messages are visible to the buyer.">
        <ol className="space-y-3">
          {x.messages.map((m) => (
            <li key={m.id} className={cn("max-w-[85%] rounded-2xl px-4 py-3 text-sm", m.authorRole === "staff" ? "ml-auto bg-indigo-50 ring-1 ring-indigo-100" : m.authorRole === "seller" ? "bg-terracotta-50 ring-1 ring-terracotta-100" : "bg-sand-100 ring-1 ring-umber-200")}>
              <p className="mb-1 flex items-center gap-2 text-xs text-umber-500">
                <Badge tone={m.authorRole === "staff" ? "indigo" : m.authorRole === "seller" ? "terracotta" : "neutral"} className="py-0 text-[10px]">
                  {m.authorRole === "seller" ? "artisan" : m.authorRole}
                </Badge>
                {authors.find((a) => a.id === m.authorUserId)?.name ?? ""} · <span title={formatDateTime(m.createdAt)}>{timeAgo(m.createdAt)}</span>
              </p>
              <p className="whitespace-pre-wrap text-umber-900">{m.body}</p>
            </li>
          ))}
        </ol>
        {!closed ? (
          <ActionForm action={replyDisputeAction} resetOnSuccess className="mt-5 space-y-2 border-t border-umber-200 pt-4">
            <input type="hidden" name="disputeId" value={x.id} />
            <TextArea name="body" rows={3} placeholder="Reply as Wahbayaan support (the buyer sees this)" aria-label="Reply" required />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4">
                <Toggle name="notify" label="Email the buyer" defaultChecked />
                <SelectInput name="nextStatus" aria-label="Then set status" className="w-auto" defaultValue="">
                  <option value="">Keep status</option>
                  <option value="awaiting_buyer">→ Awaiting buyer</option>
                  <option value="awaiting_seller">→ Awaiting artisan</option>
                  <option value="under_review">→ Under review</option>
                </SelectInput>
              </div>
              <SubmitButton>Send reply</SubmitButton>
            </div>
          </ActionForm>
        ) : null}
      </Panel>
    </>
  );

  const side = (
    <>
      <Panel title="Order">
        <KV
          items={[
            ["Order", <Link key="o" href={`/admin/orders/${o.number}`} className="text-indigo-800 hover:underline">{o.number}</Link>],
            ["Buyer", `${o.customerName}`],
            ["Total", <OrderAmount key="t" amount={o.total} currency={o.currency} />],
            ["Refunded so far", refunded ? <OrderAmount key="r" amount={refunded} currency={o.currency} /> : "—"],
            ["Order status", ORDER_STATUS_LABEL[o.status] ?? o.status],
            ["Funds", <StatusBadge key="f" kind="funds" status={o.fundsState} />],
          ]}
        />
      </Panel>
      <Panel title="Triage">
        <ActionForm action={assignDisputeAction} className="flex gap-2">
          <input type="hidden" name="disputeId" value={x.id} />
          <SelectInput name="assigneeId" defaultValue={x.assignedToId ?? ""} aria-label="Assignee">
            <option value="">Unassigned</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.id === user.id ? "(me)" : ""}
              </option>
            ))}
          </SelectInput>
          <SubmitButton variant="outline">Assign</SubmitButton>
        </ActionForm>
        {canResolve && !closed ? (
          <ActionForm action={setDisputeStatusAction} className="mt-3 flex gap-2">
            <input type="hidden" name="disputeId" value={x.id} />
            <SelectInput name="status" defaultValue={x.status} aria-label="Status">
              <option value="open">Open</option>
              <option value="awaiting_seller">Awaiting artisan</option>
              <option value="awaiting_buyer">Awaiting buyer</option>
              <option value="under_review">Under review</option>
            </SelectInput>
            <SubmitButton variant="outline">Set</SubmitButton>
          </ActionForm>
        ) : null}
      </Panel>
      {canResolve && !closed ? (
        <Panel title="Resolve" description={`Refund amounts in ${o.currency}. Resolving closes the case and settles the frozen funds.`}>
          <ActionForm action={resolveDisputeAction} inline className="space-y-3">
            <input type="hidden" name="disputeId" value={x.id} />
            <FieldRow label="Outcome">
              <SelectInput name="resolution" defaultValue="partial_refund">
                <option value="refund">Full refund ({orderMoney(o.total - refunded, o.currency)})</option>
                <option value="partial_refund">Partial refund, release the rest</option>
                <option value="replacement">Replacement — artisan remakes, funds stay held</option>
                <option value="no_action">No action — release funds to the artisan</option>
              </SelectInput>
            </FieldRow>
            <FieldRow label={`Partial refund (${o.currency})`} hint="Only for a partial refund">
              <TextInput name="refundAmount" inputMode="decimal" placeholder="0.00" />
            </FieldRow>
            <FieldRow label="Resolution note (sent to the buyer)">
              <TextArea name="note" rows={3} required placeholder="What we decided and why" />
            </FieldRow>
            <SubmitButton variant="accent" confirm="Resolve this case now? Refunds and releases happen immediately.">
              Resolve case
            </SubmitButton>
          </ActionForm>
        </Panel>
      ) : null}
      <NotesPanel entity="dispute" entityId={x.id} currentUserId={user.id} />
      <AuditTrail entity="dispute" entityId={x.id} />
    </>
  );

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Disputes", href: "/admin/disputes" }, { label: x.number }]} />
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {x.number}
            <StatusBadge kind="dispute" status={x.status} className="font-sans text-sm" />
            <DemoBadge show={o.isDemo} />
          </span>
        }
        description={`${DISPUTE_REASON_LABEL[x.reason]} · order ${o.number} · ${o.customerName}`}
      />
      <DetailGrid main={main} side={side} />
    </div>
  );
}
