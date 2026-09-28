"use server";

import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { sessions, staffRoles, users } from "@/lib/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { ALL_PERMISSIONS } from "@/lib/auth/permissions";
import { sendEmail } from "@/lib/email";
import { adminAction, AdminError } from "@/lib/admin/action";
import { generatePassword } from "@/lib/admin/staff";
import { checkStaffChange, type StaffChange } from "@/lib/admin/staff-rules";
import { zOptStr, zStr, zUuid } from "@/lib/admin/zod";

async function loadStaffState() {
  const d = await db();
  const [staff, roles] = await Promise.all([
    d.select({ id: users.id, status: users.status, staffRoleId: users.staffRoleId, name: users.name, email: users.email }).from(users).where(eq(users.role, "staff")),
    d.select().from(staffRoles),
  ]);
  return { staff, roles };
}

async function guard(change: StaffChange) {
  const { staff, roles } = await loadStaffState();
  const err = checkStaffChange(staff, roles, change);
  if (err) throw new AdminError(err);
  return { staff, roles };
}

async function loadStaffUser(id: string) {
  const d = await db();
  const u = await d.query.users.findFirst({ where: eq(users.id, id), with: { staffRole: true } });
  if (!u || u.role !== "staff") throw new AdminError("Staff member not found.");
  return u;
}

// ── Staff members ───────────────────────────────────────────────────────────

export const inviteStaffAction = adminAction("staff.manage", z.object({ name: zStr(120), email: z.email("Enter a valid email"), roleId: zUuid }), async ({ user, data, audit }) => {
  const d = await db();
  const email = data.email.trim().toLowerCase();
  const role = await d.query.staffRoles.findFirst({ where: eq(staffRoles.id, data.roleId) });
  if (!role) throw new AdminError("Pick a role.");
  const existing = await d.query.users.findFirst({ where: eq(sql`lower(${users.email})`, email) });
  if (existing?.role === "staff") throw new AdminError("That email already has a staff account.");
  if (existing) throw new AdminError(`That email belongs to a ${existing.role} account. Use a separate work email for staff access.`);
  const password = generatePassword();
  const [created] = await d.insert(users).values({ email, name: data.name, passwordHash: await hashPassword(password), role: "staff", staffRoleId: role.id }).returning();
  const appUrl = process.env.APP_URL ?? "";
  await sendEmail({
    to: email,
    subject: "You've been added to the Wahbayaan admin",
    template: "staff_invite",
    body: [`Hello ${data.name},`, "", `${user.name} added you to the Wahbayaan admin as ${role.name}.`, "", `Sign in at ${appUrl}/login with:`, `Email: ${email}`, `Temporary password: ${password}`, "", "Please change it after your first sign-in."].join("\n"),
  });
  await audit({ action: "staff.invite", entity: "staff", entityId: created.id, summary: `Invited ${data.name} <${email}> as ${role.name}`, data: { after: { email, name: data.name, role: role.name } } });
  return { message: `${data.name} invited as ${role.name}`, data: { "Temporary password (shown once)": password } };
});

export const changeStaffRoleAction = adminAction("staff.manage", z.object({ userId: zUuid, roleId: zUuid }), async ({ data, audit }) => {
  const u = await loadStaffUser(data.userId);
  if (u.staffRoleId === data.roleId) return { message: "No change" };
  const { roles } = await guard({ kind: "user", userId: u.id, staffRoleId: data.roleId });
  const role = roles.find((r) => r.id === data.roleId);
  if (!role) throw new AdminError("Role not found.");
  const d = await db();
  await d.update(users).set({ staffRoleId: role.id }).where(eq(users.id, u.id));
  await audit({ action: "staff.role", entity: "staff", entityId: u.id, summary: `${u.name}: role ${u.staffRole?.name ?? "none"} → ${role.name}`, data: { before: { role: u.staffRole?.name ?? null }, after: { role: role.name } } });
  return { message: `${u.name} is now ${role.name}` };
});

export const setStaffStatusAction = adminAction("staff.manage", z.object({ userId: zUuid, status: z.enum(["active", "suspended"]) }), async ({ user, data, audit }) => {
  const u = await loadStaffUser(data.userId);
  if (u.id === user.id && data.status === "suspended") throw new AdminError("You can't deactivate your own account.");
  if (u.status === data.status) return { message: "No change" };
  await guard({ kind: "user", userId: u.id, status: data.status });
  const d = await db();
  await d.update(users).set({ status: data.status }).where(eq(users.id, u.id));
  // Deactivation signs the person out everywhere.
  if (data.status === "suspended") await d.delete(sessions).where(eq(sessions.userId, u.id));
  await audit({ action: data.status === "suspended" ? "staff.deactivate" : "staff.reactivate", entity: "staff", entityId: u.id, summary: `${data.status === "suspended" ? "Deactivated" : "Reactivated"} ${u.name}`, data: { before: { status: u.status }, after: { status: data.status } } });
  return { message: `${u.name} ${data.status === "suspended" ? "deactivated and signed out" : "reactivated"}` };
});

export const resetStaffPasswordAction = adminAction("staff.manage", z.object({ userId: zUuid }), async ({ data, audit }) => {
  const u = await loadStaffUser(data.userId);
  const password = generatePassword();
  const d = await db();
  await d.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, u.id));
  await d.delete(sessions).where(eq(sessions.userId, u.id));
  await audit({ action: "staff.reset_password", entity: "staff", entityId: u.id, summary: `Reset the password for ${u.name} (signed out of all sessions)` });
  return { message: `New password set for ${u.name}`, data: { "Temporary password (shown once)": password } };
});

// ── Roles ───────────────────────────────────────────────────────────────────

const zPerms = z.preprocess((v) => (v == null ? [] : Array.isArray(v) ? v : [v]), z.array(z.enum(ALL_PERMISSIONS as [string, ...string[]])));

export const saveRoleAction = adminAction("staff.manage", z.object({ id: z.string().optional(), name: zStr(60), description: zOptStr(300), permissions: zPerms }), async ({ data, audit }) => {
  const d = await db();
  if (data.id) {
    const before = await d.query.staffRoles.findFirst({ where: eq(staffRoles.id, data.id) });
    if (!before) throw new AdminError("Role not found.");
    const permissions = before.isSystem ? ALL_PERMISSIONS : data.permissions;
    await guard({ kind: "role", roleId: before.id, permissions });
    await d.update(staffRoles).set({ name: data.name, description: data.description, permissions }).where(eq(staffRoles.id, before.id));
    await audit({ action: "role.update", entity: "role", entityId: before.id, summary: `Edited role ${before.name}${before.name !== data.name ? ` → ${data.name}` : ""} (${permissions.length} permissions)`, data: { before: { name: before.name, description: before.description, permissions: before.permissions }, after: { name: data.name, description: data.description, permissions } } });
    return { message: "Role saved" };
  }
  const [r] = await d.insert(staffRoles).values({ name: data.name, description: data.description, permissions: data.permissions }).returning();
  await audit({ action: "role.create", entity: "role", entityId: r.id, summary: `Created role ${data.name} (${data.permissions.length} permissions)`, data: { after: { name: data.name, permissions: data.permissions } } });
  return { message: `Role ${data.name} created` };
});

/** Save the whole permission matrix. Checkboxes are named `perm:<roleId>` with the permission as value. */
export const saveRoleMatrixAction = adminAction("staff.manage", z.object({ roles: z.preprocess((v) => (v == null ? [] : Array.isArray(v) ? v : [v]), z.array(z.string().uuid())) }), async ({ data, formData, audit }) => {
  const { roles } = await loadStaffState();
  const next: Record<string, string[]> = {};
  const valid = new Set<string>(ALL_PERMISSIONS);
  for (const id of data.roles) {
    const role = roles.find((r) => r.id === id);
    if (!role || role.isSystem) continue;
    next[id] = formData.getAll(`perm:${id}`).map(String).filter((p) => valid.has(p));
  }
  await guard({ kind: "roles", permissions: next });
  const d = await db();
  const changes: string[] = [];
  const detail: Record<string, { added: string[]; removed: string[] }> = {};
  for (const [id, perms] of Object.entries(next)) {
    const role = roles.find((r) => r.id === id)!;
    const added = perms.filter((p) => !role.permissions.includes(p));
    const removed = role.permissions.filter((p) => !perms.includes(p));
    if (!added.length && !removed.length) continue;
    await d.update(staffRoles).set({ permissions: perms }).where(eq(staffRoles.id, id));
    detail[role.name] = { added, removed };
    changes.push(`${role.name} ${[added.length ? `+${added.length}` : "", removed.length ? `−${removed.length}` : ""].filter(Boolean).join(" ")}`);
  }
  if (!changes.length) return { message: "No permission changes" };
  await audit({ action: "role.matrix", entity: "role", summary: `Updated role permissions: ${changes.join(", ")}`, data: detail });
  return { message: `Permissions updated for ${changes.length} role${changes.length === 1 ? "" : "s"}` };
});

export const deleteRoleAction = adminAction("staff.manage", z.object({ id: zUuid }), async ({ data, audit }) => {
  const d = await db();
  const r = await d.query.staffRoles.findFirst({ where: eq(staffRoles.id, data.id) });
  if (!r) throw new AdminError("Role not found.");
  if (r.isSystem) throw new AdminError("The Owner role can't be deleted.");
  const [{ n }] = await d.select({ n: sql<number>`count(*)::int` }).from(users).where(eq(users.staffRoleId, r.id));
  if (n) throw new AdminError(`${n} staff member${n === 1 ? " still has" : "s still have"} this role. Move them to another role first.`);
  await d.delete(staffRoles).where(eq(staffRoles.id, r.id));
  await audit({ action: "role.delete", entity: "role", entityId: r.id, summary: `Deleted role ${r.name}`, data: { before: r } });
  return { message: `Role ${r.name} deleted` };
});

