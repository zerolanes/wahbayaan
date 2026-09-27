"use server";

import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { disputes, notifications, users } from "@/lib/db/schema";
import { addDisputeMessage, resolveDispute } from "@/lib/commerce/orders";
import { sendEmail } from "@/lib/email";
import { adminAction, AdminError } from "@/lib/admin/action";
import { orderMoney } from "@/lib/admin/money";
import { zBool, zIds, zOptMoney, zStr, zUuid } from "@/lib/admin/zod";

async function loadDispute(id: string) {
  const d = await db();
  const x = await d.query.disputes.findFirst({ where: eq(disputes.id, id), with: { order: true } });
  if (!x) throw new AdminError("Case not found");
  return x;
}

export const replyDisputeAction = adminAction(
  "disputes.view",
  z.object({ disputeId: zUuid, body: zStr(5000), notify: zBool, nextStatus: z.enum(["", "awaiting_buyer", "awaiting_seller", "under_review"]).optional() }),
  async ({ user, data, audit }) => {
    const x = await loadDispute(data.disputeId);
    if (["resolved", "closed"].includes(x.status)) throw new AdminError("This case is closed.");
    await addDisputeMessage(x.id, { userId: user.id, role: "staff" }, data.body);
    const d = await db();
    if (data.nextStatus) await d.update(disputes).set({ status: data.nextStatus }).where(eq(disputes.id, x.id));
    if (x.userId) await d.insert(notifications).values({ userId: x.userId, kind: "dispute", title: `New message on case ${x.number}`, link: `/account/disputes/${x.number}` });
    if (data.notify)
      await sendEmail({
        to: x.order.email,
        subject: `Update on your case ${x.number}`,
        template: "dispute_reply",
        body: `Our team replied on case ${x.number} for order ${x.order.number}:\n\n${data.body}\n\nReply from your order page.`,
      });
    await audit({ action: "dispute.reply", entity: "dispute", entityId: x.id, summary: `Replied on case ${x.number}${data.nextStatus ? ` and set it to ${data.nextStatus.replace(/_/g, " ")}` : ""}` });
    return { message: data.notify ? "Reply posted and buyer emailed" : "Reply posted" };
  },
);

export const setDisputeStatusAction = adminAction(
  "disputes.resolve",
  z.object({ disputeId: zUuid, status: z.enum(["open", "awaiting_seller", "awaiting_buyer", "under_review"]) }),
  async ({ data, audit }) => {
    const x = await loadDispute(data.disputeId);
    if (["resolved", "closed"].includes(x.status)) throw new AdminError("Resolved cases can't be reopened here.");
    const d = await db();
    await d.update(disputes).set({ status: data.status }).where(eq(disputes.id, x.id));
    await audit({ action: "dispute.status", entity: "dispute", entityId: x.id, summary: `Set case ${x.number} to ${data.status.replace(/_/g, " ")}`, data: { from: x.status } });
    return { message: "Status updated" };
  },
);

export const assignDisputeAction = adminAction(
  "disputes.view",
  z.object({ disputeId: zUuid, assigneeId: z.string().optional() }),
  async ({ data, audit }) => {
    const x = await loadDispute(data.disputeId);
    const d = await db();
    let name = "nobody";
    if (data.assigneeId) {
      const u = await d.query.users.findFirst({ where: eq(users.id, data.assigneeId) });
      if (!u || u.role !== "staff") throw new AdminError("Pick a staff member.");
      name = u.name;
    }
    await d.update(disputes).set({ assignedToId: data.assigneeId || null }).where(eq(disputes.id, x.id));
    await audit({ action: "dispute.assign", entity: "dispute", entityId: x.id, summary: `Assigned case ${x.number} to ${name}` });
    return { message: `Assigned to ${name}` };
  },
);

export const resolveDisputeAction = adminAction(
  "disputes.resolve",
  z.object({ disputeId: zUuid, resolution: z.enum(["refund", "partial_refund", "replacement", "no_action"]), refundAmount: zOptMoney, note: zStr(2000) }),
  async ({ user, data, audit }) => {
    const x = await loadDispute(data.disputeId);
    if (["resolved", "closed"].includes(x.status)) throw new AdminError("This case is already resolved.");
    if (data.resolution === "partial_refund" && !data.refundAmount) throw new AdminError(`Enter the partial refund amount in ${x.order.currency}.`);
    await resolveDispute(x.id, user.id, { resolution: data.resolution, refundAmount: data.refundAmount ?? undefined, note: data.note });
    await sendEmail({
      to: x.order.email,
      subject: `Case ${x.number} resolved`,
      template: "dispute_resolved",
      body: `Your case ${x.number} for order ${x.order.number} has been resolved: ${data.resolution.replace("_", " ")}${data.resolution === "partial_refund" && data.refundAmount ? ` (${orderMoney(data.refundAmount, x.order.currency)})` : ""}.\n\n${data.note}`,
    });
    await audit({
      action: "dispute.resolve",
      entity: "dispute",
      entityId: x.id,
      summary: `Resolved case ${x.number}: ${data.resolution.replace("_", " ")}${data.refundAmount ? ` ${orderMoney(data.refundAmount, x.order.currency)}` : ""}`,
      data,
    });
    return { message: "Case resolved and the buyer was emailed" };
  },
);

export const bulkDisputesAction = adminAction(
  "disputes.view",
  z.object({ op: z.enum(["assign_me", "under_review"]), ids: zIds }),
  async ({ user, data, audit }) => {
    if (!data.ids.length) throw new AdminError("Select at least one case.");
    const d = await db();
    if (data.op === "under_review" && !user.permissions.has("disputes.resolve")) throw new AdminError("Changing case status needs disputes.resolve.");
    const rows = await d.select().from(disputes).where(inArray(disputes.id, data.ids));
    const open = rows.filter((r) => !["resolved", "closed"].includes(r.status));
    if (open.length)
      await d
        .update(disputes)
        .set(data.op === "assign_me" ? { assignedToId: user.id } : { status: "under_review" })
        .where(inArray(disputes.id, open.map((r) => r.id)));
    await audit({ action: `dispute.bulk_${data.op}`, entity: "dispute", summary: `Bulk ${data.op.replace("_", " ")} on ${open.length} case(s)`, data: { ids: open.map((r) => r.number) } });
    return { message: `${open.length} case${open.length === 1 ? "" : "s"} updated` };
  },
);
