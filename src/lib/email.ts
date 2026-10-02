import "server-only";
import { eq } from "drizzle-orm";
import { renderEmailHtml } from "./email-html";
import { db } from "@/lib/db/client";
import { emailOutbox } from "@/lib/db/schema";

/**
 * Queue an email. Without RESEND_API_KEY the message is only recorded in the
 * outbox (Admin → Email outbox) with status "logged" — nothing is sent.
 */
export async function sendEmail(msg: { to: string; subject: string; body: string; template?: string }) {
  const d = await db();
  const [row] = await d.insert(emailOutbox).values({ ...msg, status: "queued" }).returning();
  return deliverOutboxEmail(row);
}

/**
 * Deliver (or re-deliver) an outbox row through Resend and record the result on
 * the same row. Without RESEND_API_KEY the row is marked "logged".
 */
export async function deliverOutboxEmail(row: { id: string; to: string; subject: string; body: string }) {
  const d = await db();
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    await d.update(emailOutbox).set({ status: "logged" }).where(eq(emailOutbox.id, row.id));
    return { sent: false as const };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "Wahbayaan <hello@wahbayaan.com>", to: row.to, subject: row.subject, text: row.body, html: renderEmailHtml(row.subject, row.body) }),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    await d.update(emailOutbox).set({ status: "sent", sentAt: new Date(), error: null }).where(eq(emailOutbox.id, row.id));
    return { sent: true as const };
  } catch (err) {
    await d.update(emailOutbox).set({ status: "failed", error: String(err) }).where(eq(emailOutbox.id, row.id));
    return { sent: false as const, error: String(err) };
  }
}
