"use server";

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { adminNotes, notifications, sessions, users } from "@/lib/db/schema";
import { adminAction, AdminError } from "@/lib/admin/action";
import { CUSTOMER_FLAG_ENTITY } from "@/lib/admin/customers";
import { zIds, zOptStr, zStr, zUuid } from "@/lib/admin/zod";

async function loadBuyer(id: string) {
  const d = await db();
  const u = await d.query.users.findFirst({ where: eq(users.id, id) });
  if (!u) throw new AdminError("Customer not found");
  if (u.role !== "buyer") throw new AdminError("Only buyer accounts are managed here — staff and artisans have their own pages.");
  return u;
}

export const flagCustomerAction = adminAction("customers.manage", z.object({ userId: zUuid, reason: zStr(500) }), async ({ user, data, audit }) => {
  const u = await loadBuyer(data.userId);
  const d = await db();
  await d.insert(adminNotes).values({ entity: CUSTOMER_FLAG_ENTITY, entityId: u.id, body: data.reason, authorId: user.id });
  await audit({ action: "customer.flag", entity: "customer", entityId: u.id, summary: `Flagged ${u.email}: ${data.reason}` });
  return { message: "Customer flagged" };
});

export const unflagCustomerAction = adminAction("customers.manage", z.object({ userId: zUuid }), async ({ data, audit }) => {
  const u = await loadBuyer(data.userId);
  const d = await db();
  const removed = await d.delete(adminNotes).where(and(eq(adminNotes.entity, CUSTOMER_FLAG_ENTITY), eq(adminNotes.entityId, u.id))).returning();
  await audit({ action: "customer.unflag", entity: "customer", entityId: u.id, summary: `Cleared the flag on ${u.email}`, data: { reasons: removed.map((r) => r.body) } });
  return { message: "Flag cleared" };
});

export const setCustomerStatusAction = adminAction(
  "customers.manage",
  z.object({ userId: zUuid, status: z.enum(["active", "suspended"]), reason: zOptStr(500) }),
  async ({ data, audit }) => {
    const u = await loadBuyer(data.userId);
    if (u.status === data.status) return { message: "No change" };
    if (data.status === "suspended" && !data.reason) throw new AdminError("Give a reason for disabling the login — it's kept in the audit log.");
    const d = await db();
    await d.update(users).set({ status: data.status }).where(eq(users.id, u.id));
    // Signing out everywhere makes the change immediate.
    if (data.status === "suspended") await d.delete(sessions).where(eq(sessions.userId, u.id));
    await audit({
      action: data.status === "suspended" ? "customer.disable_login" : "customer.enable_login",
      entity: "customer",
      entityId: u.id,
      summary: data.status === "suspended" ? `Disabled login for ${u.email}: ${data.reason}` : `Re-enabled login for ${u.email}`,
    });
    return { message: data.status === "suspended" ? "Login disabled and sessions signed out" : "Login re-enabled" };
  },
);

export const setWholesaleAction = adminAction("customers.manage", z.object({ userId: zUuid, on: z.enum(["1", "0"]) }), async ({ data, audit }) => {
  const u = await loadBuyer(data.userId);
  const on = data.on === "1";
  if (u.isWholesale === on) return { message: "No change" };
  const d = await db();
  await d.update(users).set({ isWholesale: on }).where(eq(users.id, u.id));
  if (on) await d.insert(notifications).values({ userId: u.id, kind: "account", title: "Your trade account is active", body: "Wholesale pricing now shows on eligible pieces.", link: "/account" });
  await audit({ action: on ? "customer.wholesale_grant" : "customer.wholesale_revoke", entity: "customer", entityId: u.id, summary: `${on ? "Granted" : "Revoked"} wholesale access for ${u.email}` });
  return { message: on ? "Wholesale access granted" : "Wholesale access revoked" };
});

export const bulkCustomersAction = adminAction(
  "customers.manage",
  z.object({ ids: zIds, op: z.enum(["suspend", "reinstate", "grant_wholesale", "revoke_wholesale"]), reason: zOptStr(500) }),
  async ({ data, audit }) => {
    if (!data.ids.length) throw new AdminError("Select at least one customer.");
    if (data.op === "suspend" && !data.reason) throw new AdminError("Give a reason for disabling logins.");
    const d = await db();
    const rows = await d.select().from(users).where(and(inArray(users.id, data.ids), eq(users.role, "buyer")));
    const ids = rows.map((r) => r.id);
    if (!ids.length) throw new AdminError("None of the selected accounts are buyers.");
    if (data.op === "suspend") {
      await d.update(users).set({ status: "suspended" }).where(inArray(users.id, ids));
      await d.delete(sessions).where(inArray(sessions.userId, ids));
    } else if (data.op === "reinstate") await d.update(users).set({ status: "active" }).where(inArray(users.id, ids));
    else await d.update(users).set({ isWholesale: data.op === "grant_wholesale" }).where(inArray(users.id, ids));
    for (const r of rows)
      await audit({ action: `customer.${data.op}`, entity: "customer", entityId: r.id, summary: `Bulk ${data.op.replace("_", " ")}: ${r.email}${data.reason ? ` — ${data.reason}` : ""}` });
    return { message: `Updated ${ids.length} customer${ids.length === 1 ? "" : "s"}` };
  },
);
