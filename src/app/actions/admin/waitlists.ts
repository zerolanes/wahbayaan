"use server";

import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { products, waitlistEntries } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email";
import { adminAction, AdminError } from "@/lib/admin/action";
import { zBool, zOptStr, zUuid } from "@/lib/admin/zod";

/** Whether buyers can actually buy the piece right now. */
function purchasable(p: typeof products.$inferSelect, now = new Date()) {
  if (p.status !== "active") return false;
  if (p.isLimitedDrop && p.dropStartsAt && p.dropStartsAt > now) return false;
  return p.availability === "made_to_order" || p.stockQty > 0;
}

/** Email everyone still waiting for a piece (queued through the email outbox) and mark them notified. */
export const notifyWaitlistAction = adminAction(
  "requests.manage",
  z.object({ productId: zUuid, message: zOptStr(1000), force: zBool }),
  async ({ data, audit }) => {
    const d = await db();
    const p = await d.query.products.findFirst({ where: eq(products.id, data.productId) });
    if (!p) throw new AdminError("Listing not found");
    if (!purchasable(p) && !data.force)
      throw new AdminError(
        p.status !== "active"
          ? "This listing isn't live, so the link would not work. Tick “send anyway” to notify regardless."
          : p.isLimitedDrop && p.dropStartsAt && p.dropStartsAt > new Date()
            ? "The drop hasn't opened yet. Tick “send anyway” to send an early heads-up."
            : "It's still out of stock. Tick “send anyway” to notify regardless.",
      );
    const waiting = await d.select().from(waitlistEntries).where(and(eq(waitlistEntries.productId, p.id), isNull(waitlistEntries.notifiedAt)));
    if (!waiting.length) throw new AdminError("Nobody is waiting — everyone on this list has already been notified.");
    const url = `${process.env.APP_URL ?? "http://localhost:3000"}/product/${p.slug}`;
    const when = p.isLimitedDrop && p.dropStartsAt && p.dropStartsAt > new Date() ? `It opens on ${p.dropStartsAt.toUTCString().slice(0, 16)}.` : "It's available now.";
    for (const w of waiting) {
      await sendEmail({
        to: w.email,
        subject: `${p.title} — you asked us to let you know`,
        template: "waitlist_notify",
        body: `${when}\n\n${data.message ? `${data.message}\n\n` : ""}${url}\n\nYou're receiving this because you joined the waitlist for this piece on Wahbayaan.`,
      });
      await d.update(waitlistEntries).set({ notifiedAt: new Date() }).where(eq(waitlistEntries.id, w.id));
    }
    await audit({ action: "waitlist.notify", entity: "waitlist", entityId: p.id, summary: `Notified ${waiting.length} waiting buyer${waiting.length === 1 ? "" : "s"} about “${p.title}”`, data: { count: waiting.length, message: data.message } });
    return { message: `Queued ${waiting.length} email${waiting.length === 1 ? "" : "s"}` };
  },
);

export const removeWaitlistEntryAction = adminAction("requests.manage", z.object({ id: zUuid }), async ({ data, audit }) => {
  const d = await db();
  const [w] = await d.delete(waitlistEntries).where(eq(waitlistEntries.id, data.id)).returning();
  if (!w) throw new AdminError("Entry not found");
  await audit({ action: "waitlist.remove", entity: "waitlist", entityId: w.productId, summary: `Removed ${w.email} from a waitlist` });
  return { message: "Removed" };
});
