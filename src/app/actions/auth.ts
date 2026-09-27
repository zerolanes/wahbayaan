"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { createSession, destroySession } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { VISITOR_COOKIE } from "@/lib/buyer-context";
import { mergeVisitorIntoUser } from "@/lib/commerce/cart";
import { isDestination } from "@/lib/money/currency";

export type AuthState = { error?: string; fields?: Record<string, string> } | null;

function safeNext(next: FormDataEntryValue | null, fallback: string) {
  const v = typeof next === "string" ? next : "";
  return v.startsWith("/") && !v.startsWith("//") ? v : fallback;
}

async function afterSignIn(userId: string) {
  const jar = await cookies();
  const visitor = jar.get(VISITOR_COOKIE)?.value;
  if (visitor) await mergeVisitorIntoUser(`visitor:${visitor}`, userId);
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const d = await db();
  const user = await d.query.users.findFirst({ where: eq(sql`lower(${users.email})`, email) });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "That email and password don't match.", fields: { email } };
  }
  if (user.status !== "active") return { error: "This account is suspended. Please contact support.", fields: { email } };
  const h = await headers();
  await createSession(user.id, h.get("user-agent"));
  await afterSignIn(user.id);
  const fallback = user.role === "staff" ? "/admin" : user.role === "seller" ? "/seller" : "/account";
  redirect(safeNext(formData.get("next"), fallback));
}

const registerSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(80),
  email: z.email("Please enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters").max(200),
  country: z.string().optional(),
  marketing: z.string().optional(),
});

export async function register(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  const fields = { name: String(formData.get("name") ?? ""), email: String(formData.get("email") ?? "") };
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };
  const d = await db();
  const email = parsed.data.email.toLowerCase();
  const exists = await d.query.users.findFirst({ where: eq(sql`lower(${users.email})`, email) });
  if (exists) return { error: "An account with this email already exists. Try signing in.", fields };
  const [user] = await d
    .insert(users)
    .values({
      email,
      name: parsed.data.name,
      passwordHash: await hashPassword(parsed.data.password),
      country: isDestination(parsed.data.country) ? parsed.data.country : null,
      marketingOptIn: parsed.data.marketing === "on",
    })
    .returning();
  const h = await headers();
  await createSession(user.id, h.get("user-agent"));
  await afterSignIn(user.id);
  redirect(safeNext(formData.get("next"), "/account"));
}

export async function logout() {
  await destroySession();
  redirect("/");
}
