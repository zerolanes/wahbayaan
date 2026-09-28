"use server";

import { inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { emailOutbox } from "@/lib/db/schema";
import { deliverOutboxEmail } from "@/lib/email";
import { adminAction, AdminError } from "@/lib/admin/action";
import { zIds } from "@/lib/admin/zod";

/** Retry delivery (failed / logged / queued) or cancel (queued) outbox emails. */
export const outboxAction = adminAction("settings.manage", z.object({ op: z.enum(["resend", "cancel"]), ids: zIds }), async ({ data, audit }) => {
  if (!data.ids.length) throw new AdminError("Select at least one email.");
  const d = await db();
  const rows = await d.select().from(emailOutbox).where(inArray(emailOutbox.id, data.ids));
  if (data.op === "cancel") {
    const ok = rows.filter((r) => r.status === "queued" || r.status === "failed");
    if (!ok.length) throw new AdminError("Only queued or failed emails can be cancelled.");
    await d.update(emailOutbox).set({ status: "cancelled" }).where(inArray(emailOutbox.id, ok.map((r) => r.id)));
    for (const r of ok) await audit({ action: "email.cancel", entity: "email", entityId: r.id, summary: `Cancelled “${r.subject}” to ${r.to}`, data: { before: { status: r.status }, after: { status: "cancelled" } } });
    return { message: `${ok.length} email${ok.length === 1 ? "" : "s"} cancelled${rows.length > ok.length ? ` · ${rows.length - ok.length} skipped` : ""}` };
  }
  if (!process.env.RESEND_API_KEY) throw new AdminError("Email sending isn't configured (RESEND_API_KEY is not set), so nothing can be delivered. Emails stay in the outbox as “logged”.");
  const ok = rows.filter((r) => r.status !== "sent");
  if (!ok.length) throw new AdminError("These emails were already sent.");
  let sent = 0;
  for (const r of ok) {
    const res = await deliverOutboxEmail(r);
    if (res.sent) sent++;
    await audit({ action: "email.resend", entity: "email", entityId: r.id, summary: `${res.sent ? "Resent" : "Resend failed for"} “${r.subject}” to ${r.to}`, data: { before: { status: r.status, error: r.error }, after: { status: res.sent ? "sent" : "failed" } } });
  }
  if (!sent) throw new AdminError(`Delivery failed for ${ok.length} email${ok.length === 1 ? "" : "s"} — see the error on each.`);
  return { message: `${sent} of ${ok.length} email${ok.length === 1 ? "" : "s"} sent` };
});
