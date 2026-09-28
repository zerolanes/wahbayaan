import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { Flag, ShieldAlert } from "lucide-react";
import { flagConversationAction, redactMessagesAction, unflagConversationAction } from "@/app/actions/admin/support";
import { ActionButton, ActionForm, SubmitButton } from "@/components/admin/action-form";
import { TextArea, Toggle } from "@/components/admin/controls";
import { AuditTrail, NotesPanel } from "@/components/admin/notes-panel";
import { DetailGrid, KV, Panel } from "@/components/admin/ui";
import { Badge, Breadcrumbs, Notice, PageHeader } from "@/components/ui/misc";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { adminNotes, conversations, messages } from "@/lib/db/schema";
import { CONTACT_LABEL, detectContactDetails, segmentContactDetails } from "@/lib/admin/moderation";
import { cn } from "@/lib/utils/cn";
import { formatDateTime, timeAgo } from "@/lib/utils/format";

export const metadata = { title: "Conversation" };

export default async function ConversationPage(props: PageProps<"/admin/conversations/[id]">) {
  const staff = await requireStaff("support.manage");
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await db();
  const c = await d.query.conversations.findFirst({ where: eq(conversations.id, id), with: { buyer: true, vendor: true, product: true } });
  if (!c) notFound();
  const [thread, flags] = await Promise.all([
    d.select().from(messages).where(eq(messages.conversationId, c.id)).orderBy(asc(messages.createdAt)),
    d.select().from(adminNotes).where(and(eq(adminNotes.entity, "conversation_flag"), eq(adminNotes.entityId, c.id))).orderBy(desc(adminNotes.createdAt)),
  ]);
  const hitCount = thread.reduce((a, m) => a + detectContactDetails(m.body).length, 0);
  const who = (senderId: string | null) => (senderId === c.buyerId ? "buyer" : senderId === c.vendor.userId ? "artisan" : "other");

  const main = (
    <>
      {hitCount ? (
        <Notice tone="danger" title={`${hitCount} contact detail${hitCount === 1 ? "" : "s"} shared in this thread`} icon={<ShieldAlert className="size-4" />}>
          Highlighted below. Redacting replaces them with “[removed by Wahbayaan]” for both sides; the original text stays in the audit log.
        </Notice>
      ) : null}
      <Panel
        title={`Thread (${thread.length})`}
        description="Read-only — staff can't post into buyer ↔ artisan conversations."
        action={
          hitCount ? (
            <ActionForm action={redactMessagesAction} confirm="Redact every contact detail in this thread?" className="flex items-center gap-3">
              <input type="hidden" name="conversationId" value={c.id} />
              <Toggle name="notify" label="Tell the sender" defaultChecked />
              <SubmitButton variant="danger">Redact all</SubmitButton>
            </ActionForm>
          ) : null
        }
      >
        {thread.length ? (
          <ol className="space-y-4">
            {thread.map((m) => {
              const side = who(m.senderUserId);
              const hits = detectContactDetails(m.body);
              return (
                <li key={m.id} className={cn("flex", side === "artisan" ? "justify-end" : "justify-start")}>
                  <div className={cn("max-w-[80%] rounded-xl border px-4 py-2.5 text-sm", side === "artisan" ? "border-umber-200 bg-umber-50" : "border-umber-200 bg-white", hits.length && "border-danger-600/40")}>
                    <p className="mb-1 flex items-center gap-2 text-xs text-umber-500">
                      <span className="font-medium text-umber-700">{side === "buyer" ? c.buyer.name : side === "artisan" ? c.vendor.displayName : "Unknown sender"}</span>
                      <span>{side}</span>
                      <span title={formatDateTime(m.createdAt)}>· {timeAgo(m.createdAt)}</span>
                      {m.readAt ? <span>· read</span> : null}
                    </p>
                    <p className="leading-relaxed whitespace-pre-wrap text-umber-900">
                      {segmentContactDetails(m.body).map((s, i) =>
                        s.hit ? (
                          <mark key={i} title={CONTACT_LABEL[s.hit]} className="rounded bg-danger-50 px-0.5 text-danger-700 ring-1 ring-danger-600/30">
                            {s.text}
                          </mark>
                        ) : (
                          <span key={i}>{s.text}</span>
                        ),
                      )}
                    </p>
                    {hits.length ? (
                      <div className="mt-2 flex items-center justify-between gap-3 border-t border-umber-200 pt-2">
                        <span className="text-xs text-danger-700">{[...new Set(hits.map((h) => CONTACT_LABEL[h.kind]))].join(", ")}</span>
                        <ActionButton action={redactMessagesAction} fields={{ conversationId: c.id, messageId: m.id, notify: "on" }} variant="outline" confirm="Redact the contact details in this message?">
                          Redact
                        </ActionButton>
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-sm text-umber-500">No messages yet.</p>
        )}
      </Panel>
    </>
  );

  const side = (
    <>
      <Panel title="Participants">
        <KV
          items={[
            ["Buyer", <Link key="b" href={`/admin/customers/${c.buyerId}`} className="text-indigo-800 hover:underline">{c.buyer.name}</Link>],
            ["Buyer email", c.buyer.email],
            ["Artisan", <Link key="a" href={`/admin/artisans/${c.vendorId}`} className="text-indigo-800 hover:underline">{c.vendor.displayName}</Link>],
            ["About", c.product ? <Link key="p" href={`/admin/listings/${c.product.id}`} className="text-indigo-800 hover:underline">{c.product.title}</Link> : "General enquiry"],
            ["Started", formatDateTime(c.createdAt)],
            ["Last message", timeAgo(c.lastMessageAt)],
          ]}
        />
      </Panel>
      <Panel title="Flag" description="Flag threads to watch, e.g. pressure to pay outside Wahbayaan.">
        {flags.length ? (
          <ul className="mb-3 space-y-1.5 text-sm">
            {flags.map((f) => (
              <li key={f.id} className="flex items-start gap-2 text-umber-800">
                <Flag className="mt-0.5 size-3.5 shrink-0 text-warning-600" />
                <span>
                  {f.body} <span className="text-xs text-umber-500">· {timeAgo(f.createdAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <ActionForm action={flagConversationAction} resetOnSuccess className="space-y-2">
          <input type="hidden" name="id" value={c.id} />
          <TextArea name="reason" rows={2} className="min-h-14" placeholder="Reason for flagging" aria-label="Reason" required />
          <div className="flex gap-2">
            <SubmitButton variant="outline">Flag conversation</SubmitButton>
            {flags.length ? (
              <Badge tone="warning" className="self-center">
                Flagged
              </Badge>
            ) : null}
          </div>
        </ActionForm>
        {flags.length ? (
          <ActionButton action={unflagConversationAction} fields={{ id: c.id }} variant="ghost" className="mt-2" confirm="Clear the flag?">
            Clear flag
          </ActionButton>
        ) : null}
      </Panel>
      <NotesPanel entity="conversation" entityId={c.id} currentUserId={staff.id} />
      <AuditTrail entity="conversation" entityId={c.id} />
    </>
  );

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Conversations", href: "/admin/conversations" }, { label: c.subject }]} />
      <PageHeader title={c.subject} description={`${c.buyer.name} ↔ ${c.vendor.displayName}`} />
      <DetailGrid main={main} side={side} />
    </div>
  );
}
