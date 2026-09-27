import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { emailOutbox } from "@/lib/db/schema";

/**
 * Queue an email. Without RESEND_API_KEY the message is only recorded in the
 * outbox (Admin → Email outbox) with status "logged" — nothing is sent.
 */
export async function sendEmail(msg: { to: string; subject: string; body: string; template?: string }) {
  const d = await db();
  const [row] = await d.insert(emailOutbox).values({ ...msg, status: "queued" }).returning();
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    await d.update(emailOutbox).set({ status: "logged" }).where(eq(emailOutbox.id, row.id));
    return { sent: false as const };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "Wahbayaan <hello@wahbayaan.com>", to: msg.to, subject: msg.subject, text: msg.body }),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    await d.update(emailOutbox).set({ status: "sent", sentAt: new Date() }).where(eq(emailOutbox.id, row.id));
    return { sent: true as const };
  } catch (err) {
    await d.update(emailOutbox).set({ status: "failed", error: String(err) }).where(eq(emailOutbox.id, row.id));
    return { sent: false as const };
  }
}
