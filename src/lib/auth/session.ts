import "server-only";
import crypto from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sessions, staffRoles, users, vendors } from "@/lib/db/schema";
import type { Permission } from "./permissions";

export const SESSION_COOKIE = "wb_session";
const SESSION_DAYS = 30;

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string, userAgent?: string | null) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  const d = await db();
  await d.insert(sessions).values({ id: hashToken(token), userId, expiresAt, userAgent: userAgent ?? null });
  await d.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const d = await db();
    await d.delete(sessions).where(eq(sessions.id, hashToken(token)));
  }
  jar.delete(SESSION_COOKIE);
}

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: "buyer" | "seller" | "staff";
  status: "active" | "suspended";
  country: string | null;
  isWholesale: boolean;
  staffRoleName: string | null;
  permissions: Set<string>;
  vendorId: string | null;
  vendorSlug: string | null;
};

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const d = await db();
  const rows = await d
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      status: users.status,
      country: users.country,
      isWholesale: users.isWholesale,
      staffRoleName: staffRoles.name,
      permissions: staffRoles.permissions,
      vendorId: vendors.id,
      vendorSlug: vendors.slug,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .leftJoin(staffRoles, eq(staffRoles.id, users.staffRoleId))
    .leftJoin(vendors, eq(vendors.userId, users.id))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (!row || row.status !== "active") return null;
  return { ...row, permissions: new Set(row.role === "staff" ? (row.permissions ?? []) : []) };
});

export function can(user: CurrentUser | null, permission: Permission) {
  return !!user && user.role === "staff" && user.permissions.has(permission);
}

export async function requireUser(next = "/account") {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  return user;
}

export async function requireSeller() {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/seller")}`);
  if (!user.vendorId) redirect("/become-a-seller");
  return user as CurrentUser & { vendorId: string; vendorSlug: string };
}

export async function requireStaff(permission?: Permission) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent("/admin")}`);
  if (user.role !== "staff") redirect("/");
  if (permission && !user.permissions.has(permission)) redirect("/admin?denied=" + encodeURIComponent(permission));
  return user;
}

/** For server actions: throws instead of redirecting when access is missing. */
export async function assertStaff(permission: Permission) {
  const user = await getCurrentUser();
  if (!user || user.role !== "staff" || !user.permissions.has(permission)) {
    throw new Error(`Missing permission: ${permission}`);
  }
  return user;
}
