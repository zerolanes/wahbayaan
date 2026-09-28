"use server";

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { notifications, users, wholesaleApplications } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email";
import { adminAction, AdminError } from "@/lib/admin/action";
import { zBool, zOptStr, zUuid } from "@/lib/admin/zod";

async function loadLead(id: string) {
  const d = await db();
  const l = await d.query.wholesaleApplications.findFirst({ where: eq(wholesaleApplications.id, id) });
  if (!l) throw new AdminError("Application not found");
  return l;
}

export const wholesaleStatusAction = adminAction(
  "requests.manage",
  z.object({ id: zUuid, status: z.enum(["new", "contacted", "rejected"]), message: zOptStr(2000), notify: zBool }),
  async ({ data, audit }) => {
    const l = await loadLead(data.id);
    const d = await db();
    await d.update(wholesaleApplications).set({ status: data.status }).where(eq(wholesaleApplications.id, l.id));
    if (data.notify && data.status === "rejected")
      await sendEmail({
        to: l.email,
        subject: "Your Wahbayaan trade application",
        template: "wholesale_rejected",
        body: `Hi ${l.contactName.split(" ")[0]},\n\nThank you for applying for a trade account for ${l.businessName}. We aren't able to offer one at the moment.${data.message ? `\n\n${data.message}` : ""}\n\nYou're always welcome to buy at retail prices.`,
      });
    await audit({ action: `wholesale.${data.status}`, entity: "wholesale", entityId: l.id, summary: `${l.businessName}: ${l.status} → ${data.status}` });
    return { message: `Marked ${data.status}` };
  },
);

/**
 * Approve a trade application: sets `isWholesale` on the buyer account with the
 * same email. Without an account yet, the lead is approved and can be re-run
 * once they register.
 */
export const approveWholesaleAction = adminAction("requests.manage", z.object({ id: zUuid, notify: zBool }), async ({ user, data, audit }) => {
  if (!user.permissions.has("customers.manage")) throw new AdminError("Granting wholesale pricing needs the “customers.manage” permission.");
  const l = await loadLead(data.id);
  const d = await db();
  const account = await d.query.users.findFirst({ where: and(eq(sql`lower(${users.email})`, l.email.toLowerCase()), eq(users.role, "buyer")) });
  if (account && !account.isWholesale) {
    await d.update(users).set({ isWholesale: true }).where(eq(users.id, account.id));
    await d.insert(notifications).values({ userId: account.id, kind: "account", title: "Your trade account is active", body: "Wholesale pricing now shows on eligible pieces.", link: "/account" });
    await audit({ action: "customer.wholesale_grant", entity: "customer", entityId: account.id, summary: `Granted wholesale access to ${account.email} (application from ${l.businessName})` });
  }
  const wasApproved = l.status === "approved";
  await d.update(wholesaleApplications).set({ status: "approved" }).where(eq(wholesaleApplications.id, l.id));
  if (data.notify && !wasApproved)
    await sendEmail({
      to: l.email,
      subject: "Your Wahbayaan trade account is approved",
      template: "wholesale_approved",
      body: account
        ? `Hi ${l.contactName.split(" ")[0]},\n\nGood news — ${l.businessName} is approved for trade pricing. Sign in with ${l.email} to see wholesale prices and minimum quantities on eligible pieces.`
        : `Hi ${l.contactName.split(" ")[0]},\n\nGood news — ${l.businessName} is approved for trade pricing. Create your account with ${l.email} and let us know; we'll switch on wholesale pricing straight away.`,
    });
  await audit({ action: "wholesale.approve", entity: "wholesale", entityId: l.id, summary: `Approved ${l.businessName}${account ? ` — ${account.email} now has wholesale pricing` : " — no buyer account with that email yet"}` });
  return { message: account ? `Approved — ${account.name} now has wholesale pricing` : "Approved — no account with that email yet; re-run once they register" };
});

export const wholesaleNotesAction = adminAction("requests.manage", z.object({ id: zUuid, notes: zOptStr(4000) }), async ({ data, audit }) => {
  const l = await loadLead(data.id);
  const d = await db();
  await d.update(wholesaleApplications).set({ notes: data.notes }).where(eq(wholesaleApplications.id, l.id));
  await audit({ action: "wholesale.notes", entity: "wholesale", entityId: l.id, summary: `Updated notes on ${l.businessName}` });
  return { message: "Notes saved" };
});
