import "server-only";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { outreachContacts, outreachMessages, outreachSuppressions } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email";
import { requestOrigin } from "@/lib/order-access";
import { getSetting } from "@/lib/settings";
import { composeOutreachEmail, outreachFooter, withFooter, type OutreachSenderSetting } from "./merge";
import { CLOSED_STATUSES, FOLLOW_UP_DAYS, statusAfterEvent, type OutreachStatus } from "./pipeline";
import { normalizeEmail } from "./skip";
import { unsubscribeUrl } from "./token";

/** Admin-only: outreach data loaders and the send path. Never import from a public route. */

/** The public address used in merge fields and links (APP_URL in production). */
export async function outreachSiteUrl() {
  return (process.env.APP_URL || (await requestOrigin())).replace(/\/$/, "");
}

export async function outreachSender(): Promise<OutreachSenderSetting> {
  return getSetting("outreach");
}

/** Facts the skip rules need for a set of contacts. */
export async function loadSendFacts(contacts: { id: string; email: string | null }[]) {
  const d = await db();
  const ids = contacts.map((c) => c.id);
  const emails = [...new Set(contacts.map((c) => normalizeEmail(c.email)).filter((e): e is string => !!e))];
  const [supp, last] = await Promise.all([
    emails.length ? d.select({ email: outreachSuppressions.email }).from(outreachSuppressions).where(inArray(sql`lower(${outreachSuppressions.email})`, emails)) : [],
    ids.length
      ? d
          .select({ contactId: outreachMessages.contactId, at: sql<Date>`max(${outreachMessages.createdAt})` })
          .from(outreachMessages)
          .where(and(inArray(outreachMessages.contactId, ids), eq(outreachMessages.kind, "email"), ne(outreachMessages.deliveryStatus, "failed")))
          .groupBy(outreachMessages.contactId)
      : [],
  ]);
  return {
    suppressed: new Set(supp.map((s) => s.email.toLowerCase())),
    lastEmailed: new Map(last.map((l) => [l.contactId, l.at ? new Date(l.at) : null])),
  };
}

type Contact = typeof outreachContacts.$inferSelect;

/**
 * Send one outreach email through the normal outbox (`sendEmail`): logged only
 * when no provider is configured. The opt-out footer is always appended here.
 * Callers must have run the skip rules first.
 */
export async function deliverOutreachEmail(input: { contact: Contact; subject: string; body: string; templateId: string | null; actorId: string; sender: OutreachSenderSetting; siteUrl: string }) {
  const { contact } = input;
  const to = normalizeEmail(contact.email);
  if (!to) throw new Error("No email address");
  const footer = outreachFooter({ sender: input.sender, siteUrl: input.siteUrl, unsubscribeUrl: unsubscribeUrl(input.siteUrl, contact.id) });
  const text = withFooter(input.body, footer);
  const res = await sendEmail({ to, subject: input.subject, body: text, template: "outreach", replyTo: input.sender.replyTo });
  const deliveryStatus = res.sent ? "sent" : "error" in res ? "failed" : "logged";
  const now = new Date();
  const from = contact.status as OutreachStatus;
  const next = deliveryStatus === "failed" ? from : statusAfterEvent(from, "email");
  const d = await db();
  await d.insert(outreachMessages).values({
    contactId: contact.id,
    kind: "email",
    toEmail: to,
    subject: input.subject,
    body: text,
    templateId: input.templateId,
    outboxId: res.outboxId,
    deliveryStatus,
    fromStatus: from,
    toStatus: next,
    actorUserId: input.actorId,
  });
  if (deliveryStatus !== "failed") {
    const followUp = !CLOSED_STATUSES.includes(next) && (!contact.nextFollowUpAt || contact.nextFollowUpAt <= now) ? new Date(now.getTime() + FOLLOW_UP_DAYS * 86_400_000) : contact.nextFollowUpAt;
    await d.update(outreachContacts).set({ status: next, lastContactedAt: now, nextFollowUpAt: followUp }).where(eq(outreachContacts.id, contact.id));
  }
  return { deliveryStatus, error: "error" in res ? res.error : undefined };
}

/** Rendered previews of every template for one contact (compose screen). */
export function previewsFor(contact: Contact, templates: { id: string; name: string; subject: string; body: string }[], sender: OutreachSenderSetting, siteUrl: string) {
  const unsub = unsubscribeUrl(siteUrl, contact.id);
  return templates.map((tpl) => {
    const r = composeOutreachEmail({ template: tpl, contact, sender, siteUrl, unsubscribeUrl: unsub });
    return { id: tpl.id, name: tpl.name, subject: r.subject, body: r.body, footer: r.footer, rawSubject: tpl.subject, rawBody: tpl.body };
  });
}
