"use server";

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { adminNotes, contactMessages, conversations, messages, notifications, users } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email";
import { getSetting } from "@/lib/settings";
import { adminAction, AdminError } from "@/lib/admin/action";
import { hasContactDetails, redactContactDetails } from "@/lib/admin/moderation";
import { zBool, zIds, zStr, zUuid } from "@/lib/admin/zod";

// ── Support inbox (contact form messages) ───────────────────────────────────

async function loadTicket(id: string) {
  const d = await db();
  const t = await d.query.contactMessages.findFirst({ where: eq(contactMessages.id, id) });
  if (!t) throw new AdminError("Message not found");
  return t;
}

export const assignTicketAction = adminAction("support.manage", z.object({ id: zUuid, assigneeId: z.string().optional() }), async ({ user, data, audit }) => {
  const t = await loadTicket(data.id);
  const d = await db();
  const assigneeId = data.assigneeId === "me" ? user.id : data.assigneeId || null;
  let name = "nobody";
  if (assigneeId) {
    const a = await d.query.users.findFirst({ where: and(eq(users.id, assigneeId), eq(users.role, "staff")) });
    if (!a) throw new AdminError("Choose an active staff member.");
    name = a.name;
  }
  await d.update(contactMessages).set({ assignedToId: assigneeId, status: t.status === "new" && assigneeId ? "open" : t.status }).where(eq(contactMessages.id, t.id));
  await audit({ action: "ticket.assign", entity: "ticket", entityId: t.id, summary: `Assigned “${t.topic}” from ${t.email} to ${name}` });
  return { message: assigneeId ? `Assigned to ${name}` : "Unassigned" };
});

export const setTicketStatusAction = adminAction("support.manage", z.object({ id: zUuid, status: z.enum(["new", "open", "resolved"]) }), async ({ data, audit }) => {
  const t = await loadTicket(data.id);
  if (t.status === data.status) return { message: "No change" };
  const d = await db();
  await d.update(contactMessages).set({ status: data.status }).where(eq(contactMessages.id, t.id));
  await audit({ action: "ticket.status", entity: "ticket", entityId: t.id, summary: `Marked “${t.topic}” from ${t.email} as ${data.status}` });
  return { message: `Marked ${data.status}` };
});

/** Reply by email (queued in the email outbox) and record the reply on the ticket. */
export const replyTicketAction = adminAction("support.manage", z.object({ id: zUuid, body: zStr(8000), resolve: zBool }), async ({ user, data, audit }) => {
  const t = await loadTicket(data.id);
  const d = await db();
  const site = await getSetting("site");
  const subject = `Re: ${t.topic}${t.orderNumber ? ` (order ${t.orderNumber})` : ""}`;
  const quoted = t.message
    .split("\n")
    .map((l) => `> ${l}`)
    .join("\n");
  const result = await sendEmail({
    to: t.email,
    subject,
    template: "support_reply",
    body: `Hi ${t.name.split(" ")[0]},\n\n${data.body}\n\n— ${user.name}, ${site.name} support\n\nYou wrote:\n${quoted}`,
  });
  await d
    .update(contactMessages)
    .set({ reply: data.body, status: data.resolve ? "resolved" : "open", assignedToId: t.assignedToId ?? user.id })
    .where(eq(contactMessages.id, t.id));
  await audit({ action: "ticket.reply", entity: "ticket", entityId: t.id, summary: `Replied to ${t.email}${data.resolve ? " and resolved" : ""}: ${data.body.slice(0, 140)}`, data: { body: data.body, sent: result.sent } });
  return { message: result.sent ? "Reply sent" : "Reply queued in the email outbox (no email provider configured)" };
});

export const bulkTicketsAction = adminAction("support.manage", z.object({ ids: zIds, op: z.enum(["assign_me", "resolve", "reopen"]) }), async ({ user, data, audit }) => {
  if (!data.ids.length) throw new AdminError("Select at least one message.");
  const d = await db();
  const rows = await d.select().from(contactMessages).where(inArray(contactMessages.id, data.ids));
  for (const t of rows) {
    const patch =
      data.op === "assign_me"
        ? { assignedToId: user.id, status: t.status === "new" ? ("open" as const) : t.status }
        : { status: data.op === "resolve" ? ("resolved" as const) : ("open" as const) };
    await d.update(contactMessages).set(patch).where(eq(contactMessages.id, t.id));
    await audit({ action: `ticket.${data.op}`, entity: "ticket", entityId: t.id, summary: `Bulk ${data.op.replace("_", " ")}: “${t.topic}” from ${t.email}` });
  }
  return { message: `Updated ${rows.length} message${rows.length === 1 ? "" : "s"}` };
});

// ── Buyer ↔ artisan conversations ───────────────────────────────────────────

export const flagConversationAction = adminAction("support.manage", z.object({ id: zUuid, reason: zStr(500) }), async ({ user, data, audit }) => {
  const d = await db();
  const c = await d.query.conversations.findFirst({ where: eq(conversations.id, data.id) });
  if (!c) throw new AdminError("Conversation not found");
  await d.insert(adminNotes).values({ entity: "conversation_flag", entityId: c.id, body: data.reason, authorId: user.id });
  await audit({ action: "conversation.flag", entity: "conversation", entityId: c.id, summary: `Flagged “${c.subject}”: ${data.reason}` });
  return { message: "Conversation flagged" };
});

export const unflagConversationAction = adminAction("support.manage", z.object({ id: zUuid }), async ({ data, audit }) => {
  const d = await db();
  await d.delete(adminNotes).where(and(eq(adminNotes.entity, "conversation_flag"), eq(adminNotes.entityId, data.id)));
  await audit({ action: "conversation.unflag", entity: "conversation", entityId: data.id, summary: "Cleared the conversation flag" });
  return { message: "Flag cleared" };
});

/**
 * Redact contact details from one message (or every message in a thread).
 * The original text is kept in the audit log; the sender is told why.
 */
export const redactMessagesAction = adminAction(
  "support.manage",
  z.object({ conversationId: zUuid, messageId: z.string().optional(), notify: zBool }),
  async ({ data, audit }) => {
    const d = await db();
    const c = await d.query.conversations.findFirst({ where: eq(conversations.id, data.conversationId) });
    if (!c) throw new AdminError("Conversation not found");
    const rows = await d
      .select()
      .from(messages)
      .where(and(eq(messages.conversationId, c.id), data.messageId ? eq(messages.id, data.messageId) : undefined));
    const targets = rows.filter((m) => hasContactDetails(m.body));
    if (!targets.length) throw new AdminError("No contact details found to remove.");
    const senders = new Set<string>();
    for (const m of targets) {
      await d.update(messages).set({ body: redactContactDetails(m.body) }).where(eq(messages.id, m.id));
      if (m.senderUserId) senders.add(m.senderUserId);
      await audit({ action: "message.redact", entity: "conversation", entityId: c.id, summary: `Removed contact details from a message in “${c.subject}”`, data: { messageId: m.id, original: m.body } });
    }
    if (data.notify)
      for (const userId of senders)
        await d.insert(notifications).values({
          userId,
          kind: "moderation",
          title: "We removed contact details from a message",
          body: "Please keep conversations and payments on Wahbayaan — it's what keeps buyer protection and escrow in place.",
          link: null,
        });
    return { message: `Redacted ${targets.length} message${targets.length === 1 ? "" : "s"}` };
  },
);
