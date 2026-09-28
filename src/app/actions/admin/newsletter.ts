"use server";

import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { newsletterSubscribers } from "@/lib/db/schema";
import { adminAction, AdminError } from "@/lib/admin/action";
import { zIds, zOptStr, zUuid } from "@/lib/admin/zod";

export const setSubscriberStatusAction = adminAction("marketing.manage", z.object({ id: zUuid, status: z.enum(["subscribed", "unsubscribed"]) }), async ({ data, audit }) => {
  const d = await db();
  const [s] = await d.update(newsletterSubscribers).set({ status: data.status }).where(eq(newsletterSubscribers.id, data.id)).returning();
  if (!s) throw new AdminError("Subscriber not found");
  await audit({ action: data.status === "subscribed" ? "newsletter.resubscribe" : "newsletter.unsubscribe", entity: "newsletter", entityId: s.id, summary: `${data.status === "subscribed" ? "Resubscribed" : "Unsubscribed"} ${s.email}` });
  return { message: data.status === "subscribed" ? "Resubscribed" : "Unsubscribed" };
});

export const bulkNewsletterAction = adminAction("marketing.manage", z.object({ ids: zIds, op: z.enum(["unsubscribe", "resubscribe", "delete"]) }), async ({ data, audit }) => {
  if (!data.ids.length) throw new AdminError("Select at least one subscriber.");
  const d = await db();
  const rows = await d.select().from(newsletterSubscribers).where(inArray(newsletterSubscribers.id, data.ids));
  if (data.op === "delete") await d.delete(newsletterSubscribers).where(inArray(newsletterSubscribers.id, data.ids));
  else await d.update(newsletterSubscribers).set({ status: data.op === "unsubscribe" ? "unsubscribed" : "subscribed" }).where(inArray(newsletterSubscribers.id, data.ids));
  await audit({ action: `newsletter.bulk_${data.op}`, entity: "newsletter", summary: `Bulk ${data.op}: ${rows.length} subscriber${rows.length === 1 ? "" : "s"}`, data: { emails: rows.map((r) => r.email) } });
  return { message: `Updated ${rows.length}` };
});

/** Add someone who asked in person (e.g. at a trade show). They must have agreed to receive email. */
export const addSubscriberAction = adminAction("marketing.manage", z.object({ email: z.email("Enter a valid email"), source: zOptStr(40) }), async ({ data, audit }) => {
  const d = await db();
  const email = data.email.trim().toLowerCase();
  const [s] = await d
    .insert(newsletterSubscribers)
    .values({ email, source: data.source ?? "admin" })
    .onConflictDoUpdate({ target: newsletterSubscribers.email, set: { status: "subscribed" } })
    .returning();
  await audit({ action: "newsletter.add", entity: "newsletter", entityId: s.id, summary: `Added ${email} to the newsletter (${data.source ?? "admin"})` });
  return { message: "Subscriber added" };
});
