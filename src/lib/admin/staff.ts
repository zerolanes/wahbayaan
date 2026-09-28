import "server-only";
import crypto from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { staffRoles, users } from "@/lib/db/schema";

/** Active staff members, optionally only those whose role grants a permission. */
export async function staffMembers(permission?: string) {
  const d = await db();
  const rows = await d
    .select({ id: users.id, name: users.name, email: users.email, status: users.status, role: staffRoles.name, permissions: staffRoles.permissions })
    .from(users)
    .leftJoin(staffRoles, eq(staffRoles.id, users.staffRoleId))
    .where(eq(users.role, "staff"))
    .orderBy(asc(users.name));
  return rows.filter((r) => r.status === "active" && (!permission || (r.permissions ?? []).includes(permission)));
}

/** A readable one-time password (no ambiguous characters). */
export function generatePassword(length = 14) {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out.replace(/(.{4})(?=.)/g, "$1-");
}
